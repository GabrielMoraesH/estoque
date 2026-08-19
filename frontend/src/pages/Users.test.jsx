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
  let editUser;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 99, role: "admin" } });
    usePermissions.mockReturnValue({ canManageUsers: true });
    useToast.mockReturnValue({ showToast: jest.fn() });
    getEmpresas.mockResolvedValue([{ id: 10, nome: "Empresa Alfa" }]);
    editUser = jest.fn().mockResolvedValue({
      id: 1,
      nome: "Ana Atualizada",
      login: "ana",
      role: "gestor",
      ativo: true,
      empresas: [{ id: 10, nome: "Empresa Alfa" }]
    });
    useUsers.mockReturnValue({
      fetchUsers: jest.fn().mockResolvedValue([{
        id: 1,
        nome: "Ana",
        login: "ana",
        role: "gestor",
        ativo: true,
        empresas: [{ id: 10, nome: "Empresa Alfa" }]
      }]),
      createUser: jest.fn(),
      editUser,
      editUserStatus: jest.fn()
    });
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
});
