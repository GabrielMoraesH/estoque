import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import OcDetails from "./OcDetails";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/BackButton", () => () => null);
jest.mock("../components/ToastProvider", () => ({ useToast: jest.fn() }));
jest.mock("../hooks/useAuth", () => jest.fn());
jest.mock("../hooks/useEmpresa", () => jest.fn());
jest.mock("../hooks/usePermissions", () => jest.fn());
jest.mock("../hooks/useOCs", () => jest.fn());
jest.mock("../hooks/useProdutos", () => jest.fn());
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>,
  useLocation: jest.fn(),
  useNavigate: jest.fn(),
  useParams: jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");
const { useLocation, useNavigate, useParams } = require("react-router-dom");

const oc = { id: 42, empresa_nome: "Empresa Alfa", assignment_fase: "contagem", assignment_ciclo: 1 };
const items = [
  { id: 501, oc_localizacao_id: 1501, new_model: true, produto: "Dipirona 500mg", endereco: "A1-01-02", status: "contado", quantidade: 12, lote: "DIP-01" },
  { id: 502, oc_localizacao_id: 1502, new_model: true, produto: "Dipirona 500mg", endereco: "A1-02-01", status: "pendente" },
  { id: 601, oc_localizacao_id: 1601, new_model: true, produto: "Amoxicilina 500mg", endereco: "B2-03-01", status: "pendente" },
  { id: 602, oc_localizacao_id: 1602, new_model: true, produto: "Amoxicilina 500mg", endereco: "B2-04-02", status: "pendente" }
];

describe("OcDetails", () => {
  let fetchEstoquistaOCs;
  let fetchOcItems;
  let fetchProdutos;
  let finalizeOc;
  let navigate;
  let showToast;
  let activeEmpresa;

  beforeEach(() => {
    jest.clearAllMocks();
    activeEmpresa = { id: 10, nome: "Empresa Alfa" };
    fetchEstoquistaOCs = jest.fn().mockResolvedValue([oc]);
    fetchOcItems = jest.fn().mockResolvedValue(items);
    fetchProdutos = jest.fn().mockResolvedValue([]);
    finalizeOc = jest.fn().mockResolvedValue({});
    navigate = jest.fn();
    showToast = jest.fn();
    useAuth.mockReturnValue({ user: { id: 9, nome: "Ana Estoquista", role: "estoquista" } });
    useEmpresa.mockImplementation(() => ({ activeEmpresa }));
    usePermissions.mockReturnValue({ canFinalizeOc: true, canViewCountingItem: true });
    useOCs.mockReturnValue({ fetchEstoquistaOCs, fetchOcItems, finalizeOc });
    useProdutos.mockReturnValue({ fetchProdutos, getLocalizacoesPorProduto: jest.fn(() => []) });
    useToast.mockReturnValue({ showToast });
    useParams.mockReturnValue({ id: "42" });
    useLocation.mockReturnValue({ pathname: "/oc/42", state: { from: "/minhas-ocs" } });
    useNavigate.mockReturnValue(navigate);
  });

  it("mostra o DataState de loading até as três fontes responderem", async () => {
    let resolveItems;
    fetchOcItems.mockReturnValue(new Promise((resolve) => { resolveItems = resolve; }));
    render(<OcDetails />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando itens da OC");
    expect(screen.queryByLabelText("Produto da OC")).not.toBeInTheDocument();
    resolveItems(items);
    expect(await screen.findByLabelText("Produto da OC")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("carrega a OC, empresa, produto inicial e progresso do assignment", async () => {
    render(<OcDetails />);

    await screen.findByLabelText("Produto da OC");
    expect(screen.getByRole("heading", { name: "OC 0042" })).toBeInTheDocument();
    expect(screen.getByText("Empresa Alfa")).toBeInTheDocument();
    expect(screen.getByLabelText("Produto da OC")).toHaveValue("Dipirona 500mg");
    expect(screen.getByText("1 de 4 localizações contadas")).toBeInTheDocument();
    expect(fetchOcItems).toHaveBeenCalledWith("42");
  });

  it("troca o produto e substitui integralmente as localizações visíveis", async () => {
    render(<OcDetails />);
    await screen.findByRole("button", { name: "Contagem concluída para Dipirona 500mg — A1-01-02" });
    expect(screen.getByRole("button", { name: "Contar localização de Dipirona 500mg — A1-02-01" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Amoxicilina/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Produto da OC"), "Amoxicilina 500mg");
    expect(screen.getByRole("button", { name: "Contar localização de Amoxicilina 500mg — B2-03-01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contar localização de Amoxicilina 500mg — B2-04-02" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dipirona/ })).not.toBeInTheDocument();
  });

  it("abre a localização pendente correta com o contrato de navegação atual", async () => {
    render(<OcDetails />);
    const action = await screen.findByRole("button", { name: "Contar localização de Dipirona 500mg — A1-02-01" });
    await userEvent.click(action);

    expect(navigate).toHaveBeenCalledWith("/contar/42/502", { state: {
      from: "/minhas-ocs", selectedProduct: "Dipirona 500mg", newModel: true, ocLocalizacaoId: 1502
    } });
  });

  it("exibe a quantidade e o lote da localização contada e bloqueia sua reabertura", async () => {
    render(<OcDetails />);
    const counted = await screen.findByRole("button", { name: "Contagem concluída para Dipirona 500mg — A1-01-02" });

    expect(counted).toBeDisabled();
    expect(within(counted).getByText("Quantidade: 12 · Lote: DIP-01")).toBeInTheDocument();
    await userEvent.click(counted);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mantém a finalização bloqueada enquanto há localizações pendentes", async () => {
    render(<OcDetails />);

    expect(await screen.findByRole("button", { name: "Finalizar contagem" })).toBeDisabled();
    expect(screen.getByText("Conclua as localizações pendentes para finalizar.")).toBeInTheDocument();
    expect(finalizeOc).not.toHaveBeenCalled();
  });

  it("finaliza uma contagem completa com o id da rota e navega", async () => {
    fetchOcItems.mockResolvedValue(items.map((item) => ({ ...item, status: "contado" })));
    render(<OcDetails />);
    await userEvent.click(await screen.findByRole("button", { name: "Finalizar contagem" }));
    const dialog = screen.getByRole("dialog", { name: "Finalizar contagem" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Finalizar contagem" }));

    await waitFor(() => expect(finalizeOc).toHaveBeenCalledWith("42"));
    expect(navigate).toHaveBeenCalledWith("/minhas-ocs", { replace: true });
  });

  it("bloqueia duplo envio enquanto a finalização está pendente", async () => {
    let resolveFinalize;
    fetchOcItems.mockResolvedValue(items.map((item) => ({ ...item, status: "contado" })));
    finalizeOc.mockReturnValue(new Promise((resolve) => { resolveFinalize = resolve; }));
    render(<OcDetails />);
    await userEvent.click(await screen.findByRole("button", { name: "Finalizar contagem" }));
    const dialog = screen.getByRole("dialog", { name: "Finalizar contagem" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Finalizar contagem" }));

    expect(within(dialog).getByRole("button", { name: "Finalizando..." })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Finalizando..." }));
    expect(finalizeOc).toHaveBeenCalledTimes(1);
    resolveFinalize({});
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });

  it.each(["Assignment incompleto", "Conflito de finalização", "Serviço indisponível"])(
    "encerra o loading, preserva a OC e permite tentar novamente após erro: %s",
    async (message) => {
      fetchOcItems.mockResolvedValue(items.map((item) => ({ ...item, status: "contado" })));
      finalizeOc.mockRejectedValue(new Error(message));
      render(<OcDetails />);
      await userEvent.click(await screen.findByRole("button", { name: "Finalizar contagem" }));
      await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finalizar contagem" }));

      await waitFor(() => expect(showToast).toHaveBeenCalledWith(message, "error"));
      expect(screen.getByRole("heading", { name: "OC 0042" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Finalizar contagem" })).toBeEnabled();
      expect(navigate).not.toHaveBeenCalled();
    }
  );

  it("exibe erro de carregamento sem manter produtos antigos", async () => {
    fetchOcItems.mockRejectedValue(new Error("Itens indisponíveis"));
    render(<OcDetails />);

    expect(await screen.findByText("Itens indisponíveis")).toBeInTheDocument();
    expect(screen.queryByLabelText("Produto da OC")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Itens indisponíveis", "error");
  });

  it("oculta a finalização quando falta permissão específica", async () => {
    usePermissions.mockReturnValue({ canFinalizeOc: false, canViewCountingItem: true });
    render(<OcDetails />);

    await screen.findByLabelText("Produto da OC");
    expect(screen.queryByRole("button", { name: "Finalizar contagem" })).not.toBeInTheDocument();
    expect(finalizeOc).not.toHaveBeenCalled();
  });

  it("redireciona sem carregar dados quando falta permissão de contagem", () => {
    usePermissions.mockReturnValue({ canFinalizeOc: false, canViewCountingItem: false });
    render(<OcDetails />);

    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(fetchOcItems).not.toHaveBeenCalled();
  });

  it("representa recontagem parcial somente com o escopo retornado pelo assignment", async () => {
    fetchOcItems.mockResolvedValue([
      { ...items[2], status: "recontar", ciclo: 2, fase: "recontagem" },
      { ...items[3], status: "contado", ciclo: 2, fase: "recontagem" }
    ]);
    render(<OcDetails />);

    expect(await screen.findByText("1 de 2 localizações contadas")).toBeInTheDocument();
    expect(screen.getByLabelText("Produto da OC")).toHaveValue("Amoxicilina 500mg");
    expect(screen.queryByText("Dipirona 500mg")).not.toBeInTheDocument();
  });

  it("aceita o modelo legado usando as localizações do catálogo", async () => {
    fetchOcItems.mockResolvedValue([{ id: 701, produto: "Dipirona 500mg", status: "pendente" }]);
    fetchProdutos.mockResolvedValue([{ produto: "Dipirona 500mg", endereco: "A1-01-02" }]);
    useProdutos.mockReturnValue({
      fetchProdutos,
      getLocalizacoesPorProduto: jest.fn((catalog, product) => catalog.filter((entry) => entry.produto === product))
    });
    render(<OcDetails />);

    expect(await screen.findByRole("button", { name: "Contar localização de Dipirona 500mg — A1-01-02" })).toBeInTheDocument();
  });

  it("limpa os dados da empresa anterior e carrega novamente após a troca", async () => {
    const view = render(<OcDetails />);
    expect(await screen.findByText("Empresa Alfa")).toBeInTheDocument();

    let resolveCompanyB;
    activeEmpresa = { id: 20, nome: "Empresa Beta" };
    fetchEstoquistaOCs.mockReturnValue(new Promise((resolve) => { resolveCompanyB = resolve; }));
    view.rerender(<OcDetails />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando itens da OC");
    expect(screen.queryByText("Empresa Alfa")).not.toBeInTheDocument();

    resolveCompanyB([{ ...oc, empresa_nome: "Empresa Beta" }]);
    expect(await screen.findByText("Empresa Beta")).toBeInTheDocument();
  });

  it("nao navega nem mostra feedback da finalizacao depois da troca", async () => {
    let resolveFinalize;
    fetchOcItems.mockResolvedValue(items.map((item) => ({ ...item, status: "contado" })));
    finalizeOc.mockReturnValue(new Promise((resolve) => { resolveFinalize = resolve; }));
    const view = render(<OcDetails />);
    await userEvent.click(await screen.findByRole("button", { name: "Finalizar contagem" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finalizar contagem" }));
    activeEmpresa = { id: 20, nome: "Empresa Beta" };
    view.rerender(<OcDetails />);
    showToast.mockClear();
    resolveFinalize({});
    await waitFor(() => expect(fetchOcItems).toHaveBeenCalledTimes(2));
    expect(navigate).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
