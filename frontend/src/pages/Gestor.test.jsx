import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Gestor from "./Gestor";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import { exportOcsCsv } from "../services/api";
import { downloadBlob } from "../utils/exportCsv";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/BackButton", () => () => null);
jest.mock("../components/ToastProvider", () => ({ useToast: jest.fn() }));
jest.mock("../hooks/useAuth", () => jest.fn());
jest.mock("../hooks/useEmpresa", () => jest.fn());
jest.mock("../hooks/usePermissions", () => jest.fn());
jest.mock("../hooks/useOCs", () => jest.fn());
jest.mock("../services/api", () => ({
  ...jest.requireActual("../services/api"),
  exportOcsCsv: jest.fn()
}));
jest.mock("../utils/exportCsv", () => ({
  ...jest.requireActual("../utils/exportCsv"),
  downloadBlob: jest.fn()
}));
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>,
  useLocation: jest.fn(),
  useNavigate: jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");
const { useLocation, useNavigate } = require("react-router-dom");

const ocs = [
  { id: 42, empresa_nome: "Empresa Alfa", status: "aberta", criador_nome: "Gestora Lia", estoquista_nome: "Ana", qtd: 2, localizacoes_contadas: 1, total_localizacoes: 3 },
  { id: 77, empresa_nome: "Empresa Alfa", status: "aguardando_aprovacao", criador_nome: "Gestor Rui", estoquista_nome: "Bruno", qtd: 1, localizacoes_contadas: 2, total_localizacoes: 2 },
  { id: 88, empresa_nome: "Empresa Alfa", status: "finalizada", criador_nome: "Gestora Lia", estoquista_nome: "Carla", qtd: 4, localizacoes_contadas: 4, total_localizacoes: 4 },
  { id: 99, empresa_nome: "Empresa Alfa", status: "aberta", assignment_fase: "recontagem", assignment_status: "ativo", criador_nome: "Gestor Rui", estoquista_nome: "Davi", qtd: 1, localizacoes_contadas: 0, total_localizacoes: 1 }
];

describe("Gestor", () => {
  let fetchGestorOCs;
  let navigate;
  let showToast;
  let activeEmpresa;

  beforeEach(() => {
    jest.clearAllMocks();
    activeEmpresa = { id: 10, nome: "Empresa Alfa" };
    fetchGestorOCs = jest.fn().mockResolvedValue(ocs);
    navigate = jest.fn();
    showToast = jest.fn();
    useAuth.mockReturnValue({ user: { id: 5, role: "gestor" } });
    useEmpresa.mockImplementation(() => ({ activeEmpresa }));
    usePermissions.mockReturnValue({ canCreateOc: true, canViewGestorOcs: true });
    useOCs.mockReturnValue({ fetchGestorOCs });
    useToast.mockReturnValue({ showToast });
    useLocation.mockReturnValue({ pathname: "/gestor" });
    useNavigate.mockReturnValue(navigate);
    exportOcsCsv.mockResolvedValue({ blob: new Blob(["csv"]), filename: "ocs.csv" });
  });

  it("oculta os cards até a request controlada resolver", async () => {
    let resolveRequest;
    fetchGestorOCs.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<Gestor />);

    expect(screen.getByRole("status")).toHaveTextContent("Carregando OCs");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    resolveRequest(ocs);
    expect(await screen.findByRole("article", { name: "OC 0042" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lista OCs e calcula os agregados operacionais", async () => {
    render(<Gestor />);
    const target = await screen.findByRole("article", { name: "OC 0042" });

    expect(within(target).getByText("Empresa Alfa")).toBeInTheDocument();
    expect(within(target).getByText("Em contagem")).toBeInTheDocument();
    expect(within(target).getByText("Ana")).toBeInTheDocument();
    expect(within(target).getByText("1 / 3 localizações")).toBeInTheDocument();
    expect(screen.getByText("Total de OCs").closest("div")).toHaveTextContent("4");
    expect(screen.getByText("Em recontagem", { selector: ".gestor-overview-label" }).closest("div")).toHaveTextContent("1");
    expect(screen.getByText("Finalizadas", { selector: ".gestor-overview-label" }).closest("div")).toHaveTextContent("1");
    expect(fetchGestorOCs).toHaveBeenCalledWith({ role: "gestor", id: 5 });
  });

  it("mostra o estado vazio real", async () => {
    fetchGestorOCs.mockResolvedValue([]);
    render(<Gestor />);
    expect(await screen.findByText("Nenhuma OC encontrada")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("encerra o loading após erro sem cards residuais", async () => {
    fetchGestorOCs.mockRejectedValue(new Error("Gestão indisponível"));
    render(<Gestor />);
    expect(await screen.findByText("Gestão indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Gestão indisponível", "error");
  });

  it("filtra por status e busca sem depender da posição dos cards", async () => {
    render(<Gestor />);
    await screen.findByRole("article", { name: "OC 0042" });
    await userEvent.selectOptions(screen.getByLabelText("Status"), "aguardando_aprovacao");
    expect(screen.getByRole("article", { name: "OC 0077" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "OC 0042" })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "todas");
    await userEvent.type(screen.getByLabelText("Buscar"), "42");
    expect(screen.getByRole("article", { name: "OC 0042" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "OC 0077" })).not.toBeInTheDocument();
  });

  it("abre a OC escolhida e preserva a origem", async () => {
    render(<Gestor />);
    const target = await screen.findByRole("article", { name: "OC 0077" });
    await userEvent.click(within(target).getByRole("button", { name: "Abrir detalhes" }));
    expect(navigate).toHaveBeenCalledWith("/gestor/oc/77", { state: { from: "/gestor" } });
  });

  it("exporta com busca normalizada e status atual", async () => {
    render(<Gestor />);
    await screen.findByRole("article", { name: "OC 0042" });
    await userEvent.type(screen.getByLabelText("Buscar"), "  Ana  ");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "em_contagem");
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(exportOcsCsv).toHaveBeenCalledWith({ search: "Ana", status: "em_contagem" }));
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "ocs.csv");
  });

  it("limpa a empresa anterior enquanto carrega a nova", async () => {
    const view = render(<Gestor />);
    expect(await screen.findByRole("article", { name: "OC 0042" })).toBeInTheDocument();
    let resolveCompanyB;
    activeEmpresa = { id: 20, nome: "Empresa Beta" };
    fetchGestorOCs.mockReturnValue(new Promise((resolve) => { resolveCompanyB = resolve; }));
    view.rerender(<Gestor />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando OCs");
    expect(screen.queryByText("Empresa Alfa")).not.toBeInTheDocument();
    resolveCompanyB([{ ...ocs[0], id: 123, empresa_nome: "Empresa Beta" }]);
    expect(await screen.findByRole("article", { name: "OC 0123" })).toHaveTextContent("Empresa Beta");
  });

  it("redireciona sem request quando não possui permissão", () => {
    usePermissions.mockReturnValue({ canCreateOc: false, canViewGestorOcs: false });
    render(<Gestor />);
    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(fetchGestorOCs).not.toHaveBeenCalled();
  });
});
