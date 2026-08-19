import { render, screen, waitFor } from "@testing-library/react";
import { getCurrentUser } from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import PrivateRoute from "./PrivateRoute";

jest.mock("../services/api", () => ({
  ...jest.requireActual("../services/api"),
  configureApiClient: jest.fn(),
  getCurrentUser: jest.fn()
}));

jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>
}), { virtual: true });

const user = { id: 1, role: "admin", empresas: [{ id: 2, nome: "São Paulo" }] };

function renderRoute({ canAccess, redirectTo } = {}) {
  return render(
    <AuthProvider>
      <PrivateRoute canAccess={canAccess} redirectTo={redirectTo}>
        <span>conteúdo protegido</span>
      </PrivateRoute>
    </AuthProvider>
  );
}

describe("PrivateRoute", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("não renderiza conteúdo nem redireciona enquanto a sessão está inicializando", () => {
    localStorage.setItem("token", "token-ficticio");
    localStorage.setItem("user", JSON.stringify(user));
    getCurrentUser.mockReturnValue(new Promise(() => {}));

    renderRoute();

    expect(screen.queryByText("conteúdo protegido")).toBeNull();
    expect(screen.queryByTestId("redirect")).toBeNull();
  });

  it("redireciona usuário anônimo para login sem renderizar conteúdo protegido", async () => {
    renderRoute();

    await waitFor(() => expect(screen.getByTestId("redirect").textContent).toBe("/"));
    expect(screen.queryByText("conteúdo protegido")).toBeNull();
  });

  it("renderiza conteúdo protegido quando canAccess permite o usuário autenticado", async () => {
    localStorage.setItem("token", "token-ficticio");
    localStorage.setItem("user", JSON.stringify(user));
    getCurrentUser.mockResolvedValue({ user });

    renderRoute({ canAccess: (currentUser) => currentUser.role === "admin" });

    expect(await screen.findByText("conteúdo protegido")).not.toBeNull();
  });

  it("redireciona role sem acesso para o destino definido pela rota", async () => {
    localStorage.setItem("token", "token-ficticio");
    localStorage.setItem("user", JSON.stringify({ ...user, role: "estoquista" }));
    getCurrentUser.mockResolvedValue({ user: { ...user, role: "estoquista" } });

    renderRoute({ canAccess: (currentUser) => currentUser.role === "admin", redirectTo: "/dashboard" });

    expect((await screen.findByTestId("redirect")).textContent).toBe("/dashboard");
  });
});
