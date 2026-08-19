import { act, render, screen, waitFor } from "@testing-library/react";
import { ApiError, configureApiClient, getCurrentUser, loginUser } from "../services/api";
import { AuthProvider, useAuthContext } from "./AuthContext";

jest.mock("../services/api", () => {
  const actual = jest.requireActual("../services/api");
  return {
    ...actual,
    configureApiClient: jest.fn(),
    getCurrentUser: jest.fn(),
    loginUser: jest.fn()
  };
});

const user = {
  id: 7,
  nome: "Usuario de teste",
  empresas: [
    { id: 2, codigo: "SP", nome: "São Paulo" },
    { id: 4, codigo: "RJ", nome: "Rio de Janeiro" }
  ]
};

let latestAuth;

function SessionProbe() {
  const auth = useAuthContext();
  latestAuth = auth;
  return <>
    <output data-testid="state">{JSON.stringify({
      initializing: auth.isInitializing,
      authenticated: auth.isAuthenticated,
      user: auth.user?.id || null,
      empresa: auth.activeEmpresa?.id || null
    })}</output>
    <button onClick={() => auth.setActiveEmpresa(4)}>empresa-rj</button>
    <button onClick={auth.logout}>logout</button>
  </>;
}

function renderProvider() {
  return render(<AuthProvider><SessionProbe /></AuthProvider>);
}

function storedSession({ token = "token-ficticio", storedUser = user, activeEmpresa } = {}) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(storedUser));
  if (activeEmpresa) localStorage.setItem("activeEmpresa", JSON.stringify(activeEmpresa));
}

function state() {
  return JSON.parse(screen.getByTestId("state").textContent);
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    latestAuth = null;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("termina anônimo sem consultar /auth/me quando não há sessão armazenada", async () => {
    renderProvider();

    await waitFor(() => expect(state()).toEqual({ initializing: false, authenticated: false, user: null, empresa: null }));
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("restaura usuário e empresa ativa quando /auth/me retorna sessão válida", async () => {
    storedSession({ activeEmpresa: { id: 4 } });
    getCurrentUser.mockResolvedValue({ user });

    renderProvider();

    expect(state().initializing).toBe(true);
    await waitFor(() => expect(state()).toEqual({ initializing: false, authenticated: true, user: 7, empresa: 4 }));
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("activeEmpresa"))).toMatchObject({ id: 4, nome: "Rio de Janeiro" });
  });

  it("persiste a sessão e seleciona a primeira empresa após login válido", async () => {
    loginUser.mockResolvedValue({ token: "novo-token-ficticio", user });
    renderProvider();
    await waitFor(() => expect(state().initializing).toBe(false));

    await act(async () => latestAuth.login({ login: "teste", senha: "senha" }));

    expect(loginUser).toHaveBeenCalledWith({ login: "teste", senha: "senha" });
    expect(state()).toEqual({ initializing: false, authenticated: true, user: 7, empresa: 2 });
    expect(localStorage.getItem("token")).toBe("novo-token-ficticio");
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({ id: 7 });
  });

  it("mantém o estado anônimo quando o login é inválido", async () => {
    loginUser.mockRejectedValue(new ApiError("Credenciais inválidas", { status: 401 }));
    renderProvider();
    await waitFor(() => expect(state().initializing).toBe(false));

    await expect(latestAuth.login({ login: "teste", senha: "senha" })).rejects.toThrow("Credenciais inválidas");

    expect(state()).toEqual({ initializing: false, authenticated: false, user: null, empresa: null });
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("encerra e remove a sessão quando /auth/me responde 401", async () => {
    storedSession();
    getCurrentUser.mockRejectedValue(new ApiError("Sessão expirada", { status: 401 }));

    renderProvider();

    await waitFor(() => expect(state()).toEqual({ initializing: false, authenticated: false, user: null, empresa: null }));
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("activeEmpresa")).toBeNull();
  });

  it("suspende a sessão em erro inesperado sem travar a inicialização", async () => {
    storedSession();
    getCurrentUser.mockRejectedValue(new Error("Falha de rede"));

    renderProvider();

    await waitFor(() => expect(state()).toEqual({ initializing: false, authenticated: false, user: null, empresa: null }));
    expect(localStorage.getItem("token")).toBe("token-ficticio");
  });

  it("troca a empresa ativa válida e logout limpa toda a sessão", async () => {
    storedSession();
    getCurrentUser.mockResolvedValue({ user });
    renderProvider();
    await waitFor(() => expect(state().empresa).toBe(2));

    await act(async () => screen.getByRole("button", { name: "empresa-rj" }).click());
    expect(state().empresa).toBe(4);
    expect(JSON.parse(localStorage.getItem("activeEmpresa"))).toMatchObject({ id: 4 });

    await act(async () => screen.getByRole("button", { name: "logout" }).click());
    expect(state()).toEqual({ initializing: false, authenticated: false, user: null, empresa: null });
    expect(localStorage.getItem("token")).toBeNull();
  });
});
