import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import GestorOcDetails from "./GestorOcDetails";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/BackButton", () => () => null);
jest.mock("../components/ToastProvider", () => ({ useToast: jest.fn() }));
jest.mock("../hooks/useAuth", () => jest.fn());
jest.mock("../hooks/useEmpresa", () => jest.fn());
jest.mock("../hooks/usePermissions", () => jest.fn());
jest.mock("../hooks/useOCs", () => jest.fn());
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>,
  useParams: jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");
const { useParams } = require("react-router-dom");

const history = {
  oc: { id: 42, empresa_nome: "Empresa Alfa", status: "aberta", criador_nome: "Gestora Lia", estoquista_nome: "Ana", qtd: 2, localizacoes_contadas: 1, total_localizacoes: 2 },
  ciclos: [
    { id: 701, ciclo: 1, fase: "contagem", status: "finalizado", estoquista_id: 11, responsavel_nome: "Ana", produto_ids: [501, 502], created_at: "2026-01-01T10:00:00Z", finalizado_em: "2026-01-01T11:00:00Z" },
    { id: 702, ciclo: 2, fase: "recontagem", status: "ativo", estoquista_id: 12, responsavel_nome: "Bruno", produto_ids: [501], created_at: "2026-01-02T10:00:00Z" }
  ],
  produtos: [
    { oc_produto_id: 501, descricao: "Dipirona 500mg", codigo: "DIP-500", status: "recontar", saldo_sistema: 10, saldo_contado: 12, saldo_sistema_snapshot: 10, saldo_contado_vigente: 12, localizacoes: [{ id: 801, endereco: "A1-01", saldo_contado: 12, lote: "L-DIP", contagens: [
      { id: 1, ciclo: 1, fase: "contagem", usuario_nome: "Ana", quantidade: 11, lote: "L-DIP", created_at: "2026-01-01T10:30:00Z", assignment_status: "finalizado" },
      { id: 2, ciclo: 2, fase: "recontagem", usuario_nome: "Bruno", quantidade: 12, lote: "L-DIP", created_at: "2026-01-02T10:30:00Z", assignment_status: "ativo" }
    ] }] },
    { oc_produto_id: 502, descricao: "Amoxicilina 500mg", codigo: "AMO-500", status: "aprovado", saldo_sistema: 5, saldo_contado: 5, localizacoes: [{ id: 802, endereco: "B2-02", saldo_contado: 5, lote: "L-AMO", contagens: [
      { id: 3, ciclo: 1, fase: "contagem", usuario_nome: "Ana", quantidade: 5, lote: "L-AMO", created_at: "2026-01-01T10:40:00Z", assignment_status: "finalizado" }
    ] }] }
  ]
};

describe("GestorOcDetails", () => {
  let fetchOcHistory;
  let fetchEstoquistas;
  let reassignAssignment;
  let showToast;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchOcHistory = jest.fn().mockResolvedValue(history);
    fetchEstoquistas = jest.fn().mockResolvedValue([{ id: 12, nome: "Bruno", ativo: true }, { id: 13, nome: "Carla", ativo: true }, { id: 14, nome: "Inativo", ativo: false }]);
    reassignAssignment = jest.fn().mockResolvedValue({});
    showToast = jest.fn();
    useAuth.mockReturnValue({ user: { id: 5, role: "gestor" } });
    useEmpresa.mockReturnValue({ activeEmpresa: { id: 10, nome: "Empresa Alfa" } });
    usePermissions.mockReturnValue({ canViewGestorOcs: true });
    useOCs.mockReturnValue({ fetchOcHistory, fetchEstoquistas, reassignAssignment });
    useToast.mockReturnValue({ showToast });
    useParams.mockReturnValue({ id: "42" });
  });

  it("mantém o conteúdo oculto durante o loading", async () => {
    let resolveRequest;
    fetchOcHistory.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<GestorOcDetails />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando detalhes da OC");
    expect(screen.queryByText("Resumo da OC")).not.toBeInTheDocument();
    resolveRequest(history);
    expect(await screen.findByText("Resumo da OC")).toBeInTheDocument();
  });

  it("exibe dados principais, resumo, ciclos e recontagem parcial", async () => {
    render(<GestorOcDetails />);
    expect(await screen.findByText("Resumo da OC")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OC 0042" })).toBeInTheDocument();
    expect(screen.getAllByText("Empresa Alfa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 2 localizações")).toBeInTheDocument();
    expect(screen.getAllByText("+2").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Ciclo 1 — Contagem" })).toBeInTheDocument();
    const cycle2 = screen.getByRole("heading", { name: "Ciclo 2 — Recontagem" }).closest("article");
    expect(cycle2).toHaveTextContent("Bruno");
    expect(cycle2).toHaveTextContent("DIP-500");
    expect(cycle2).not.toHaveTextContent("AMO-500");
  });

  it("preserva a ordem lógica, responsáveis, quantidades e lotes por localização", async () => {
    render(<GestorOcDetails />);
    const product = (await screen.findByRole("heading", { name: "Dipirona 500mg" })).closest("article");
    const firstCount = within(product).getByText("Ciclo 1 — Contagem").closest("li");
    const recount = within(product).getByText("Ciclo 2 — Recontagem").closest("li");
    expect(firstCount).toHaveTextContent("Ana · Quantidade 11 · Lote L-DIP");
    expect(recount).toHaveTextContent("Bruno · Quantidade 12 · Lote L-DIP");
    const untouched = screen.getByRole("heading", { name: "Amoxicilina 500mg" }).closest("article");
    expect(within(untouched).getAllByRole("listitem")).toHaveLength(1);
  });

  it("mostra vazio e erro de carregamento", async () => {
    fetchOcHistory.mockResolvedValue({});
    const view = render(<GestorOcDetails />);
    expect(await screen.findByText("OC não localizada")).toBeInTheDocument();
    view.unmount();
    fetchOcHistory.mockRejectedValue(new Error("Histórico indisponível"));
    render(<GestorOcDetails />);
    expect(await screen.findByText("Histórico indisponível")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Histórico indisponível", "error");
  });

  it("reatribui com ids corretos, bloqueia duplo envio e atualiza o responsável", async () => {
    let resolveReassign;
    reassignAssignment.mockReturnValue(new Promise((resolve) => { resolveReassign = resolve; }));
    const refreshed = { ...history, oc: { ...history.oc, estoquista_nome: "Carla" }, ciclos: history.ciclos.map((cycle) => cycle.id === 702 ? { ...cycle, estoquista_id: 13, responsavel_nome: "Carla" } : cycle) };
    fetchOcHistory.mockResolvedValueOnce(history).mockResolvedValueOnce(refreshed);
    render(<GestorOcDetails />);
    await userEvent.click(await screen.findByRole("button", { name: "Reatribuir responsável" }));
    expect(fetchEstoquistas).toHaveBeenCalledWith({ nivel: 2 });
    await screen.findByRole("option", { name: "Carla" });
    expect(screen.queryByRole("option", { name: "Inativo" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Novo responsável elegível"), "13");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reatribuição" }));
    expect(screen.getByRole("button", { name: "Reatribuindo…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Reatribuindo…" }));
    expect(reassignAssignment).toHaveBeenCalledTimes(1);
    expect(reassignAssignment).toHaveBeenCalledWith("42", 702, 13);
    resolveReassign({});
    await waitFor(() => expect(screen.queryByLabelText("Novo responsável elegível")).not.toBeInTheDocument());
    expect(screen.getAllByText("Carla").length).toBeGreaterThan(0);
    expect(showToast).toHaveBeenCalledWith("Responsável reatribuído com sucesso.", "success");
  });

  it("impede confirmação vazia", async () => {
    render(<GestorOcDetails />);
    await userEvent.click(await screen.findByRole("button", { name: "Reatribuir responsável" }));
    await screen.findByRole("option", { name: "Carla" });
    await userEvent.selectOptions(screen.getByLabelText("Novo responsável elegível"), "");
    expect(screen.getByRole("button", { name: "Confirmar reatribuição" })).toBeDisabled();
    expect(reassignAssignment).not.toHaveBeenCalled();
  });

  it("mantém modal e responsável anterior após falha e permite nova tentativa", async () => {
    reassignAssignment.mockRejectedValueOnce(new Error("Conflito de reatribuição")).mockResolvedValueOnce({});
    fetchOcHistory.mockResolvedValueOnce(history).mockResolvedValueOnce({ ...history, oc: { ...history.oc, estoquista_nome: "Carla" } });
    render(<GestorOcDetails />);
    await userEvent.click(await screen.findByRole("button", { name: "Reatribuir responsável" }));
    await screen.findByRole("option", { name: "Carla" });
    await userEvent.selectOptions(screen.getByLabelText("Novo responsável elegível"), "13");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reatribuição" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Conflito de reatribuição");
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Confirmar reatribuição" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reatribuição" }));
    await waitFor(() => expect(reassignAssignment).toHaveBeenCalledTimes(2));
  });

  it("redireciona sem consultar histórico quando falta permissão", () => {
    usePermissions.mockReturnValue({ canViewGestorOcs: false });
    render(<GestorOcDetails />);
    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(fetchOcHistory).not.toHaveBeenCalled();
  });
});
