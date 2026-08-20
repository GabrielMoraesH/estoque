import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Aprovacao from "./Aprovacao";
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
  useLocation: () => ({ pathname: "/aprovacao", state: null }),
  useNavigate: () => jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");

const oc = {
  id: 42,
  empresa_id: 10,
  empresa_nome: "Hospital Central",
  qtd: 2,
  gestor_nome: "Gisele Gestora",
  estoquista_nome: "Ana Primeira",
  estoquista_id: 21,
  primeira_contagem_estoquista_id: 21,
  updated_at: "2026-01-10T10:00:00.000Z"
};
const items = [
  { id: 501, oc_produto_id: 501, produto: "Dipirona 500mg", codigo: "DIP-500", status: "contado", saldo_sistema: 10, saldo_contado: 8, lote: "L1" },
  { id: 502, oc_produto_id: 502, produto: "Amoxicilina 500mg", codigo: "AMO-500", status: "contado", saldo_sistema: 5, saldo_contado: 5, lote: "L2" }
];

function renderPage() {
  return render(<Aprovacao />);
}

function getDipironaCheckbox() {
  return within(screen.getByRole("row", { name: /Dipirona 500mg/ })).getByRole("checkbox", { name: "Selecionar Dipirona 500mg para recontagem" });
}

async function openDetails() {
  await screen.findByRole("button", { name: "Abrir detalhes" });
  await userEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
  await screen.findByRole("region", { name: "Detalhes da OC 0042" });
  await screen.findByRole("row", { name: /Dipirona 500mg/ });
}

describe("Aprovacao", () => {
  let showToast;
  let fetchApprovalOCs;
  let fetchOcItems;
  let approveOc;
  let fetchEstoquistas;
  let sendOcItemsToRecount;
  let fetchProdutos;
  let activeEmpresa;

  beforeEach(() => {
    jest.clearAllMocks();
    showToast = jest.fn();
    fetchApprovalOCs = jest.fn().mockResolvedValue([oc]);
    fetchOcItems = jest.fn().mockResolvedValue(items);
    approveOc = jest.fn().mockResolvedValue({});
    fetchEstoquistas = jest.fn().mockResolvedValue([
      { id: 21, nome: "Ana Primeira", ativo: true, nivel_estoquista: 2, empresas: [{ id: 10 }] },
      { id: 22, nome: "Bruno Nível Dois", ativo: true, nivel_estoquista: 2, empresas: [{ id: 10 }] },
      { id: 23, nome: "Carla Nível Um", ativo: true, nivel_estoquista: 1, empresas: [{ id: 10 }] }
    ]);
    sendOcItemsToRecount = jest.fn().mockResolvedValue({});
    fetchProdutos = jest.fn().mockResolvedValue([]);
    useToast.mockReturnValue({ showToast });
    useAuth.mockReturnValue({ user: { id: 7, role: "gestor" } });
    activeEmpresa = { id: 10 };
    useEmpresa.mockImplementation(() => ({ activeEmpresa }));
    usePermissions.mockReturnValue({ canApproveOc: true, canRequestRecount: true });
    useOCs.mockReturnValue({ approveOc, fetchApprovalOCs, fetchEstoquistas, fetchOcItems, sendOcItemsToRecount });
    useProdutos.mockReturnValue({ fetchProdutos, getLocalizacoesPorProduto: () => [] });
  });

  it("renderiza a fila com a OC elegível e seus controles", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Aprovação" })).toBeInTheDocument();
    expect(await screen.findByLabelText("OC 0042 aguardando aprovação")).toBeInTheDocument();
    expect(screen.getByText("AGUARDANDO APROVAÇÃO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir detalhes" })).toBeEnabled();
    expect(fetchApprovalOCs).toHaveBeenCalledWith({ role: "gestor", id: 7 });
  });

  it("exibe loading sem dados prematuros e encerra ao concluir a busca", async () => {
    let resolveFetch;
    fetchApprovalOCs.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    renderPage();
    expect(screen.getByText("Carregando OCs para aprovação")).toBeInTheDocument();
    expect(screen.queryByText("OC 0042")).not.toBeInTheDocument();
    resolveFetch([oc]);
    expect(await screen.findByText("OC 0042")).toBeInTheDocument();
    expect(screen.queryByText("Carregando OCs para aprovação")).not.toBeInTheDocument();
  });

  it("mostra os estados vazio e de erro de carregamento", async () => {
    fetchApprovalOCs.mockResolvedValue([]);
    const { unmount } = renderPage();
    expect(await screen.findByText("Nenhuma OC aguardando aprovação")).toBeInTheDocument();
    unmount();
    fetchApprovalOCs.mockRejectedValue(new Error("Serviço indisponível"));
    renderPage();
    expect(await screen.findByText("Não foi possível carregar as aprovações")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Serviço indisponível", "error");
  });

  it("abre detalhes com empresa, responsável e produtos", async () => {
    renderPage();
    await openDetails();
    expect(within(screen.getByRole("region", { name: "Detalhes da OC 0042" })).getByText("Hospital Central")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Detalhes da OC 0042" })).getByText("Responsável operacional: Ana Primeira")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Dipirona 500mg/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Amoxicilina 500mg/ })).toBeInTheDocument();
  });

  it("aprova a OC correta, bloqueia duplo envio e remove a OC da fila", async () => {
    let resolveApprove;
    approveOc.mockReturnValue(new Promise((resolve) => { resolveApprove = resolve; }));
    renderPage();
    await screen.findByRole("button", { name: "Aprovar" });
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    const dialog = screen.getByRole("dialog", { name: "Aprovar OC" });
    expect(dialog).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Aprovar" }));
    expect(approveOc).toHaveBeenCalledWith(42);
    expect(within(dialog).getByRole("button", { name: "Aprovando..." })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Aprovando..." }));
    expect(approveOc).toHaveBeenCalledTimes(1);
    resolveApprove({});
    expect(await screen.findByText("Nenhuma OC aguardando aprovação")).toBeInTheDocument();
  });

  it("encerra o loading de aprovação após erro e permite nova tentativa", async () => {
    approveOc.mockRejectedValueOnce(new Error("Conflito de aprovação")).mockResolvedValueOnce({});
    renderPage();
    await screen.findByRole("button", { name: "Aprovar" });
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Aprovar OC" })).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Conflito de aprovação", "error"));
    expect(screen.queryByRole("dialog", { name: "Aprovar OC" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Aprovar OC" })).getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(approveOc).toHaveBeenCalledTimes(2));
  });

  it("impede solicitar recontagem sem selecionar produtos", async () => {
    renderPage();
    await openDetails();
    await userEvent.click(screen.getByRole("button", { name: "Enviar para recontagem" }));
    expect(showToast).toHaveBeenCalledWith("Selecione pelo menos um item para recontagem.", "info");
    expect(fetchEstoquistas).not.toHaveBeenCalled();
  });

  it("suprime erro de aprovacao pertencente a empresa anterior", async () => {
    let rejectApprove;
    approveOc.mockReturnValue(new Promise((_resolve, reject) => { rejectApprove = reject; }));
    const view = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Aprovar" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aprovar" }));
    activeEmpresa = { id: 20 };
    view.rerender(<Aprovacao />);
    showToast.mockClear();
    rejectApprove(new Error("Erro da Empresa Alfa"));
    await waitFor(() => expect(fetchApprovalOCs).toHaveBeenCalledTimes(2));
    expect(showToast).not.toHaveBeenCalled();
  });

  it("envia somente o produto selecionado ao estoquista de nível 2", async () => {
    renderPage();
    await openDetails();
    await userEvent.click(getDipironaCheckbox());
    await userEvent.click(screen.getByRole("button", { name: "Enviar para recontagem" }));
    expect(await screen.findByRole("dialog", { name: "Enviar para recontagem" })).toBeInTheDocument();
    expect(fetchEstoquistas).toHaveBeenCalledWith({ nivel: 2 });
    await screen.findByRole("option", { name: /Bruno Nível Dois/ });
    expect(screen.queryByRole("option", { name: /Ana Primeira/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Carla Nível Um/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Estoquista"), "22");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sendOcItemsToRecount).toHaveBeenCalledWith(42, [501], 22));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Enviar para recontagem" })).not.toBeInTheDocument());
  });

  it("não envia recontagem sem responsável e preserva a seleção após erro", async () => {
    sendOcItemsToRecount.mockRejectedValue(new Error("Recontagem indisponível"));
    renderPage();
    await openDetails();
    await userEvent.click(getDipironaCheckbox());
    await userEvent.click(screen.getByRole("button", { name: "Enviar para recontagem" }));
    await screen.findByRole("option", { name: /Bruno Nível Dois/ });
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(sendOcItemsToRecount).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Selecione o estoquista responsável pela recontagem.", "error");
    await userEvent.selectOptions(screen.getByLabelText("Estoquista"), "22");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Recontagem indisponível", "error"));
    expect(screen.getByRole("dialog", { name: "Enviar para recontagem" })).toBeInTheDocument();
    expect(getDipironaCheckbox()).toBeChecked();
  });

  it("nao faz refresh nem mostra sucesso de recontagem apos trocar de empresa", async () => {
    let resolveRecount;
    sendOcItemsToRecount.mockReturnValue(new Promise((resolve) => { resolveRecount = resolve; }));
    const view = renderPage();
    await openDetails();
    await userEvent.click(getDipironaCheckbox());
    await userEvent.click(screen.getByRole("button", { name: "Enviar para recontagem" }));
    await screen.findByRole("option", { name: /Bruno/ });
    await userEvent.selectOptions(screen.getByLabelText("Estoquista"), "22");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    activeEmpresa = { id: 20 };
    view.rerender(<Aprovacao />);
    showToast.mockClear();
    resolveRecount({});
    await waitFor(() => expect(fetchApprovalOCs).toHaveBeenCalledTimes(2));
    expect(showToast).not.toHaveBeenCalled();
    expect(fetchApprovalOCs).toHaveBeenCalledTimes(2);
  });
});
