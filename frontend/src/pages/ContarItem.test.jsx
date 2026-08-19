import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ContarItem from "./ContarItem";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/ToastProvider", () => ({ useToast: jest.fn() }));
jest.mock("../hooks/useEmpresa", () => jest.fn());
jest.mock("../hooks/usePermissions", () => jest.fn());
jest.mock("../hooks/useOCs", () => jest.fn());
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>,
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
  useParams: jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");
const { useLocation, useNavigate, useParams } = require("react-router-dom");

const item = {
  id: 501,
  oc_localizacao_id: 501,
  new_model: true,
  produto: "Dipirona 500mg",
  endereco: "A1-01-02",
  status: "pendente",
  codigo_barras_snapshot: "789100000001",
  validade_snapshot: "2027-01-31"
};

function renderPage() {
  return render(<ContarItem />);
}

async function fillValidForm() {
  await screen.findByLabelText("Quantidade");
  await userEvent.type(screen.getByLabelText("Quantidade"), "60");
  await userEvent.type(screen.getByLabelText("Lote"), "LOTE-QA-01");
}

describe("ContarItem", () => {
  let fetchOcItems;
  let saveItemCount;
  let showToast;
  let navigate;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchOcItems = jest.fn().mockResolvedValue([item]);
    saveItemCount = jest.fn().mockResolvedValue({ id: 900 });
    showToast = jest.fn();
    navigate = jest.fn();
    useToast.mockReturnValue({ showToast });
    useEmpresa.mockReturnValue({ activeEmpresa: { id: 10 } });
    usePermissions.mockReturnValue({ canCountOc: true });
    useOCs.mockReturnValue({ fetchOcItems, saveItemCount });
    useParams.mockReturnValue({ ocId: "42", itemId: "501" });
    useLocation.mockReturnValue({ pathname: "/oc/42/contar/501", state: { from: "/minhas-ocs" } });
    useNavigate.mockReturnValue(navigate);
  });

  it("exibe loading sem formulário prematuro e apresenta a localização carregada", async () => {
    let resolveItems;
    fetchOcItems.mockReturnValue(new Promise((resolve) => { resolveItems = resolve; }));
    renderPage();

    expect(screen.getByText("Carregando localização")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    expect(fetchOcItems).toHaveBeenCalledWith("42");

    resolveItems([item]);
    expect(await screen.findByText("Dipirona 500mg")).toBeInTheDocument();
    expect(screen.getByText("Localização: A1-01-02")).toBeInTheDocument();
    expect(screen.getByText("Código de barras: 789100000001")).toBeInTheDocument();
    expect(screen.queryByText("Carregando localização")).not.toBeInTheDocument();
  });

  it("aceita quantidade inteira não negativa e lote e habilita o envio", async () => {
    renderPage();
    await fillValidForm();

    expect(screen.getByLabelText("Quantidade")).toHaveValue(60);
    expect(screen.getByLabelText("Lote")).toHaveValue("LOTE-QA-01");
    expect(screen.getByRole("button", { name: "Salvar contagem" })).toBeEnabled();
  });

  it("mantém o envio bloqueado e mostra validações para campos vazios", async () => {
    renderPage();
    await screen.findByLabelText("Quantidade");
    await userEvent.click(screen.getByLabelText("Quantidade"));
    await userEvent.tab();
    await userEvent.tab();

    expect(screen.getByText("Informe uma quantidade inteira maior ou igual a zero.")).toBeInTheDocument();
    expect(screen.getByText("Informe o lote.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar contagem" })).toBeDisabled();
    expect(saveItemCount).not.toHaveBeenCalled();
  });

  it("rejeita quantidade negativa e decimal conforme a regra do formulário", async () => {
    renderPage();
    const quantity = await screen.findByLabelText("Quantidade");
    await userEvent.type(quantity, "-1");
    await userEvent.tab();
    expect(screen.getByText("Informe uma quantidade inteira maior ou igual a zero.")).toBeInTheDocument();

    await userEvent.clear(quantity);
    await userEvent.type(quantity, "1.5");
    expect(screen.getByRole("button", { name: "Salvar contagem" })).toBeDisabled();
    expect(saveItemCount).not.toHaveBeenCalled();
  });

  it("salva o modelo atual com payload relevante e navega após sucesso", async () => {
    renderPage();
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Salvar contagem" }));

    await waitFor(() => expect(saveItemCount).toHaveBeenCalledWith({
      oc_id: "42",
      oc_localizacao_id: 501,
      quantidade: 60,
      lote: "LOTE-QA-01"
    }));
    expect(showToast).toHaveBeenCalledWith("Contagem registrada com sucesso.");
    expect(navigate).toHaveBeenCalledWith("/oc/42", {
      replace: true,
      state: { from: "/minhas-ocs", selectedProduct: "Dipirona 500mg" }
    });
  });

  it("suporta item legado de recontagem sem trocar item ou produto", async () => {
    fetchOcItems.mockResolvedValue([{ id: 777, produto: "Amoxicilina 500mg", endereco: "B2-03", status: "recontar", ciclo: 2 }]);
    useParams.mockReturnValue({ ocId: "42", itemId: "777" });
    renderPage();
    await userEvent.type(await screen.findByLabelText("Quantidade"), "8");
    await userEvent.type(screen.getByLabelText("Lote"), "LOTE-R2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar contagem" }));

    await waitFor(() => expect(saveItemCount).toHaveBeenCalledWith({
      oc_id: "42", item_id: "777", quantidade: 8, lote: "LOTE-R2"
    }));
    expect(navigate).toHaveBeenCalledWith("/oc/42", expect.objectContaining({
      state: expect.objectContaining({ selectedProduct: "Amoxicilina 500mg" })
    }));
  });

  it("bloqueia duplo envio enquanto a gravação está pendente", async () => {
    let resolveSave;
    saveItemCount.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    renderPage();
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Salvar contagem" }));

    const savingButton = screen.getByRole("button", { name: "Salvando contagem..." });
    expect(savingButton).toBeDisabled();
    await userEvent.click(savingButton);
    expect(saveItemCount).toHaveBeenCalledTimes(1);

    resolveSave({ id: 900 });
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["validação 400", "Quantidade incompatível com o assignment"],
    ["conflito 409", "Esta localização já foi contada"],
    ["falha 500/rede", "Serviço temporariamente indisponível"]
  ])("encerra o loading, preserva os dados e permite tentar novamente em %s", async (_case, message) => {
    saveItemCount.mockRejectedValue(new Error(message));
    renderPage();
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Salvar contagem" }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(message, "error"));
    expect(screen.getByLabelText("Quantidade")).toHaveValue(60);
    expect(screen.getByLabelText("Lote")).toHaveValue("LOTE-QA-01");
    expect(screen.getByRole("button", { name: "Salvar contagem" })).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mostra falha de carregamento e não renderiza o formulário", async () => {
    fetchOcItems.mockRejectedValue(new Error("Assignment indisponível"));
    renderPage();

    expect(await screen.findByText("Assignment indisponível")).toBeInTheDocument();
    expect(screen.getByText("Localização indisponível")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
  });

  it("impede segunda contagem de localização já contada", async () => {
    fetchOcItems.mockResolvedValue([{ ...item, status: "contado" }]);
    renderPage();

    expect(await screen.findByText("Localização já contada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar contagem" })).not.toBeInTheDocument();
  });

  it("redireciona quem não pode contar sem buscar itens", () => {
    usePermissions.mockReturnValue({ canCountOc: false });
    renderPage();

    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(fetchOcItems).not.toHaveBeenCalled();
  });

  it("volta para a OC preservando a origem", async () => {
    renderPage();
    await screen.findByLabelText("Quantidade");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(navigate).toHaveBeenCalledWith("/oc/42", {
      state: { from: "/minhas-ocs", selectedProduct: "Dipirona 500mg" }
    });
  });
});
