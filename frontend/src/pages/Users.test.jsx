import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Users from "./Users";
import useAuth from "../hooks/useAuth";
import usePermissions from "../hooks/usePermissions";
import useUsers from "../hooks/useUsers";
import { getEmpresas } from "../services/api";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/BackButton", () => () => null);
jest.mock("../components/ToastProvider", () => ({ useToast: jest.fn() }));
jest.mock("../hooks/useAuth", () => jest.fn());
jest.mock("../hooks/usePermissions", () => jest.fn());
jest.mock("../hooks/useUsers", () => jest.fn());
jest.mock("../services/api", () => ({
  ...jest.requireActual("../services/api"),
  getEmpresas: jest.fn()
}));
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");

describe("Users", () => {
  let fetchUsers;
  let createUser;
  let editUser;
  let editUserStatus;
  let showToast;

  const users = [{
    id: 1,
    nome: "Ana",
    login: "ana",
    role: "gestor",
    ativo: true,
    empresas: [{ id: 10, nome: "Empresa Alfa" }]
  }, {
    id: 2,
    nome: "Bruno",
    login: "bruno.estoque",
    role: "estoquista",
    nivel_estoquista: 2,
    ativo: false,
    empresas: [{ id: 10, nome: "Empresa Alfa" }, { id: 20, nome: "Empresa Beta" }]
  }];

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 99, role: "admin" } });
    usePermissions.mockReturnValue({ canManageUsers: true });
    showToast = jest.fn();
    useToast.mockReturnValue({ showToast });
    getEmpresas.mockResolvedValue([
      { id: 10, nome: "Empresa Alfa" },
      { id: 20, nome: "Empresa Beta" }
    ]);
    fetchUsers = jest.fn().mockResolvedValue(users);
    createUser = jest.fn();
    editUserStatus = jest.fn();
    editUser = jest.fn().mockResolvedValue({
      id: 1,
      nome: "Ana Atualizada",
      login: "ana",
      role: "gestor",
      ativo: true,
      empresas: [{ id: 10, nome: "Empresa Alfa" }]
    });
    useUsers.mockReturnValue({
      fetchUsers,
      createUser,
      editUser,
      editUserStatus
    });
  });

  it("mantem a lista oculta durante o loading e a exibe apos a resposta", async () => {
    let resolveUsers;
    fetchUsers.mockReturnValue(new Promise((resolve) => { resolveUsers = resolve; }));
    render(<Users />);

    expect(screen.getByRole("status")).toHaveTextContent(/Carregando usu/);
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    resolveUsers(users);
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lista perfis, niveis, status e empresas vinculadas", async () => {
    render(<Users />);

    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("ana")).toBeInTheDocument();
    expect(screen.getAllByText("Gestor").length).toBeGreaterThan(0);
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText("bruno.estoque")).toBeInTheDocument();
    expect(screen.getAllByText("Estoquista").length).toBeGreaterThan(0);
    expect(screen.getByText(/N.vel 2/)).toBeInTheDocument();
    expect(screen.getByText("Empresa Alfa +1")).toHaveAttribute("title", "Empresa Alfa, Empresa Beta");
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });

  it("mostra o estado vazio real", async () => {
    fetchUsers.mockResolvedValue([]);
    render(<Users />);
    expect(await screen.findByText(/Nenhum usu.rio cadastrado/)).toBeInTheDocument();
  });

  it("encerra o loading e mostra erro da listagem", async () => {
    fetchUsers.mockRejectedValue(new Error("Usuarios indisponiveis"));
    render(<Users />);
    expect(await screen.findByText("Usuarios indisponiveis")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Usuarios indisponiveis", "error");
  });

  it("filtra por busca, perfil e status", async () => {
    render(<Users />);
    await screen.findByText("Ana");

    await userEvent.type(screen.getByLabelText(/Buscar por nome ou login/), "bruno.estoque");
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/Buscar por nome ou login/));
    await userEvent.selectOptions(screen.getByLabelText("Perfil", { selector: "#users-role-filter" }), "gestor");
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Perfil", { selector: "#users-role-filter" }), "all");
    await userEvent.selectOptions(screen.getByLabelText("Status", { selector: "#users-status-filter" }), "inactive");
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("cria estoquista nivel 2 com dois vinculos e atualiza a lista", async () => {
    createUser.mockResolvedValue({
      id: 3, nome: "Carla", login: "carla", role: "estoquista",
      nivel_estoquista: 2, ativo: true,
      empresas: [{ id: 10, nome: "Empresa Alfa" }, { id: 20, nome: "Empresa Beta" }]
    });
    render(<Users />);
    await screen.findByText("Ana");

    await userEvent.type(screen.getByLabelText(/Nome \*/), "Carla");
    await userEvent.type(screen.getByLabelText(/Login \*/), "carla");
    await userEvent.type(screen.getByLabelText(/Senha \*/), "senha-ficticia");
    await userEvent.selectOptions(screen.getByLabelText("Perfil", { selector: "#role" }), "estoquista");
    await userEvent.selectOptions(screen.getByLabelText(/N.vel/, { selector: "#nivel_estoquista" }), "2");
    await userEvent.click(screen.getByRole("checkbox", { name: "Empresa Alfa" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Empresa Beta" }));
    await userEvent.click(screen.getByRole("button", { name: /Criar usu/ }));

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    expect(createUser.mock.calls[0][0]).toEqual(expect.objectContaining({
      nome: "Carla", login: "carla", senha: "senha-ficticia",
      role: "estoquista", nivel_estoquista: 2, empresa_ids: [10, 20]
    }));
    expect(await screen.findByText("Carla")).toBeInTheDocument();
  });

  it("valida empresa obrigatoria antes da criacao", async () => {
    render(<Users />);
    await screen.findByText("Ana");
    await userEvent.type(screen.getByLabelText(/Nome \*/), "Carla");
    await userEvent.type(screen.getByLabelText(/Login \*/), "carla");
    await userEvent.type(screen.getByLabelText(/Senha \*/), "senha-ficticia");
    await userEvent.click(screen.getByRole("button", { name: /Criar usu/ }));
    expect(createUser).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Selecione ao menos uma empresa de acesso.", "error");
  });

  it("bloqueia duplo envio enquanto a criacao esta pendente", async () => {
    createUser.mockReturnValue(new Promise(() => {}));
    render(<Users />);
    await screen.findByText("Ana");
    await userEvent.type(screen.getByLabelText(/Nome \*/), "Carla");
    await userEvent.type(screen.getByLabelText(/Login \*/), "carla");
    await userEvent.type(screen.getByLabelText(/Senha \*/), "senha-ficticia");
    await userEvent.click(screen.getByRole("checkbox", { name: "Empresa Alfa" }));
    const submit = screen.getByRole("button", { name: /Criar usu/ });
    await userEvent.dblClick(submit);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Criando..." })).toBeDisabled();
  });

  it("preserva o formulario e permite nova tentativa apos erro de criacao", async () => {
    createUser.mockRejectedValueOnce(new Error("Login ja existe")).mockResolvedValueOnce({
      id: 3, nome: "Carla", login: "carla", role: "gestor", ativo: true,
      empresas: [{ id: 10, nome: "Empresa Alfa" }]
    });
    render(<Users />);
    await screen.findByText("Ana");
    await userEvent.type(screen.getByLabelText(/Nome \*/), "Carla");
    await userEvent.type(screen.getByLabelText(/Login \*/), "carla");
    await userEvent.type(screen.getByLabelText(/Senha \*/), "senha-ficticia");
    await userEvent.click(screen.getByRole("checkbox", { name: "Empresa Alfa" }));
    await userEvent.click(screen.getByRole("button", { name: /Criar usu/ }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Login ja existe", "error"));
    expect(screen.getByLabelText(/Nome \*/)).toHaveValue("Carla");
    await userEvent.click(screen.getByRole("button", { name: /Criar usu/ }));
    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(2));
  });

  it("nao envia senha vazia ao editar outros dados", async () => {
    render(<Users />);

    await userEvent.click(await screen.findByRole("button", { name: "Editar Ana" }));
    const nome = screen.getByLabelText("Nome", { selector: "#edit-nome" });
    await userEvent.clear(nome);
    await userEvent.type(nome, "Ana Atualizada");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alteracoes" }));

    await waitFor(() => expect(editUser).toHaveBeenCalledTimes(1));
    const payload = editUser.mock.calls[0][1];
    expect(payload).not.toHaveProperty("senha");
    expect(payload).toEqual(expect.objectContaining({ nome: "Ana Atualizada", empresa_ids: [10] }));
  });

  it("envia a nova senha informada na edicao", async () => {
    render(<Users />);

    await userEvent.click(await screen.findByRole("button", { name: "Editar Ana" }));
    await userEvent.type(screen.getByLabelText("Nova senha"), "nova-senha-ficticia");
    await userEvent.click(screen.getByRole("button", { name: "Salvar alteracoes" }));

    await waitFor(() => expect(editUser).toHaveBeenCalledTimes(1));
    expect(editUser.mock.calls[0][1]).toHaveProperty("senha", "nova-senha-ficticia");
  });

  it("edita role, nivel e remove um vinculo multiempresa", async () => {
    editUser.mockResolvedValue({
      id: 2, nome: "Bruno", login: "bruno.estoque", role: "gestor",
      nivel_estoquista: null, ativo: false, empresas: [{ id: 20, nome: "Empresa Beta" }]
    });
    render(<Users />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar Bruno" }));
    expect(screen.getByLabelText("Login", { selector: "#edit-login" })).toHaveValue("bruno.estoque");
    await userEvent.selectOptions(screen.getByLabelText("Perfil", { selector: "#edit-role" }), "gestor");
    await userEvent.click(screen.getByRole("button", { name: "Remover acesso a Empresa Alfa" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar alteracoes" }));
    await waitFor(() => expect(editUser).toHaveBeenCalledTimes(1));
    expect(editUser.mock.calls[0][1]).toEqual(expect.objectContaining({
      role: "gestor", nivel_estoquista: null, empresa_ids: [20]
    }));
  });

  it("desativa usuario e atualiza o status visual", async () => {
    editUserStatus.mockResolvedValue({ ...users[0], ativo: false });
    render(<Users />);
    await userEvent.click(await screen.findByRole("button", { name: "Desativar Ana" }));
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editUserStatus).toHaveBeenCalledWith(1, { ativo: false }));
    await waitFor(() => expect(screen.getAllByText("Inativo")).toHaveLength(2));
  });

  it("redireciona sem carregar dados quando nao possui permissao", () => {
    usePermissions.mockReturnValue({ canManageUsers: false });
    render(<Users />);
    expect(screen.getByTestId("redirect")).toHaveTextContent("/dashboard");
    expect(fetchUsers).not.toHaveBeenCalled();
    expect(getEmpresas).not.toHaveBeenCalled();
  });
});
