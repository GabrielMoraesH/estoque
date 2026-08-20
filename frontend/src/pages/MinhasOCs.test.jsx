import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MinhasOCs from "./MinhasOCs";
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
  useLocation: jest.fn(),
  useNavigate: jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");
const { useLocation, useNavigate } = require("react-router-dom");

const ocs = [
  { id: 42, empresa_nome: "Empresa Alfa", estoquista_nome: "Ana Estoquista", qtd: 2, qtd_contados: 1 },
  { id: 77, empresa_nome: "Empresa Alfa", estoquista_nome: "Ana Estoquista", qtd: 2, qtd_contados: 2 }
];

describe("MinhasOCs", () => {
  let fetchEstoquistaOCs;
  let finalizeOc;
  let navigate;
  let showToast;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchEstoquistaOCs = jest.fn().mockResolvedValue(ocs);
    finalizeOc = jest.fn().mockResolvedValue({});
    navigate = jest.fn();
    showToast = jest.fn();
    useAuth.mockReturnValue({ user: { id: 9, nome: "Ana Estoquista", role: "estoquista" } });
    useEmpresa.mockReturnValue({ activeEmpresa: { id: 10, nome: "Empresa Alfa" } });
    usePermissions.mockReturnValue({ canFinalizeOc: true, canViewOwnOcs: true });
    useOCs.mockReturnValue({ fetchEstoquistaOCs, finalizeOc });
    useToast.mockReturnValue({ showToast });
    useLocation.mockReturnValue({ pathname: "/minhas-ocs", state: null });
    useNavigate.mockReturnValue(navigate);
  });

  it("mantém os cards ocultos durante o loading e os exibe após a resposta", async () => {
    let resolveRequest;
    fetchEstoquistaOCs.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<MinhasOCs />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando suas OCs");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    resolveRequest(ocs);

    expect(await screen.findByRole("article", { name: "OC 0042" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("exibe as OCs retornadas com código, status, responsável e progresso", async () => {
    render(<MinhasOCs />);

    const emAndamento = await screen.findByRole("article", { name: "OC 0042" });
    const pronta = screen.getByRole("article", { name: "OC 0077" });
    expect(within(emAndamento).getByText("EM ANDAMENTO")).toBeInTheDocument();
    expect(within(emAndamento).getByText("Responsável: Ana Estoquista")).toBeInTheDocument();
    expect(within(emAndamento).getByText("1 de 2 localizações contadas")).toBeInTheDocument();
    expect(within(pronta).getByText("PRONTA PARA FINALIZAR")).toBeInTheDocument();
    expect(within(pronta).getByText("2 de 2 localizações contadas")).toBeInTheDocument();
    expect(fetchEstoquistaOCs).toHaveBeenCalledWith({ role: "estoquista", id: 9 });
  });

  it("mostra o estado vazio real", async () => {
    fetchEstoquistaOCs.mockResolvedValue([]);
    render(<MinhasOCs />);

    expect(await screen.findByText("Nenhuma OC disponível")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("encerra o loading e apresenta a falha da API", async () => {
    fetchEstoquistaOCs.mockRejectedValue(new Error("Serviço de OCs indisponível"));
    render(<MinhasOCs />);

    expect(await screen.findByText("Serviço de OCs indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Serviço de OCs indisponível", "error");
  });

  it("abre a OC escolhida preservando a origem", async () => {
    render(<MinhasOCs />);
    const target = await screen.findByRole("article", { name: "OC 0077" });
    await userEvent.click(within(target).getByRole("button", { name: "Abrir OC" }));

    expect(navigate).toHaveBeenCalledWith("/oc/77", { state: { from: "/minhas-ocs" } });
  });

  it("mantém a finalização bloqueada enquanto a OC está incompleta", async () => {
    render(<MinhasOCs />);
    const target = await screen.findByRole("article", { name: "OC 0042" });
    expect(within(target).getByRole("button", { name: "Finalizar contagem" })).toBeDisabled();
    expect(finalizeOc).not.toHaveBeenCalled();
  });

  it("confirma a finalização pronta e remove apenas a OC finalizada", async () => {
    render(<MinhasOCs />);
    const target = await screen.findByRole("article", { name: "OC 0077" });
    await userEvent.click(within(target).getByRole("button", { name: "Finalizar contagem" }));
    const dialog = screen.getByRole("dialog", { name: "Finalizar contagem" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Finalizar contagem" }));

    await waitFor(() => expect(finalizeOc).toHaveBeenCalledWith(77));
    await waitFor(() => expect(screen.queryByRole("article", { name: "OC 0077" })).not.toBeInTheDocument());
    expect(screen.getByRole("article", { name: "OC 0042" })).toBeInTheDocument();
  });

  it("redireciona sem consultar a API quando falta permissão", () => {
    usePermissions.mockReturnValue({ canFinalizeOc: false, canViewOwnOcs: false });
    render(<MinhasOCs />);

    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(fetchEstoquistaOCs).not.toHaveBeenCalled();
  });

  it("ignora finalizacao antiga apos trocar de empresa", async () => {
    let activeEmpresa = { id: 10, nome: "Empresa Alfa" };
    let resolveFinalize;
    useEmpresa.mockImplementation(() => ({ activeEmpresa }));
    finalizeOc.mockReturnValue(new Promise((resolve) => { resolveFinalize = resolve; }));
    const view = render(<MinhasOCs />);
    const target = await screen.findByRole("article", { name: "OC 0077" });
    await userEvent.click(within(target).getByRole("button", { name: "Finalizar contagem" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Finalizar contagem" }));
    activeEmpresa = { id: 20, nome: "Empresa Beta" };
    view.rerender(<MinhasOCs />);
    await screen.findByRole("article", { name: "OC 0077" });
    showToast.mockClear();
    resolveFinalize({});
    await waitFor(() => expect(finalizeOc).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("article", { name: "OC 0077" })).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });
});
