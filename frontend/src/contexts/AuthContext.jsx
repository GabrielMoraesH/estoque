import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, configureApiClient, getCurrentUser, loginUser } from "../services/api";

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = "token";
const USER_STORAGE_KEY = "user";
const ACTIVE_EMPRESA_STORAGE_KEY = "activeEmpresa";

function normalizeEmpresas(empresas) {
  return Array.isArray(empresas)
    ? empresas
      .map((empresa) => ({
        id: Number(empresa?.id),
        codigo: empresa?.codigo || "",
        nome: empresa?.nome || ""
      }))
      .filter((empresa) => Number.isInteger(empresa.id) && empresa.id > 0 && empresa.nome)
    : [];
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    empresas: normalizeEmpresas(user.empresas)
  };
}

function resolveActiveEmpresa(user, storedEmpresa) {
  const empresas = normalizeEmpresas(user?.empresas);

  if (empresas.length === 0) {
    return null;
  }

  const storedEmpresaId = Number(storedEmpresa?.id);
  const savedEmpresa = empresas.find((empresa) => empresa.id === storedEmpresaId);

  return savedEmpresa || empresas[0];
}

function readStoredActiveEmpresa() {
  const rawActiveEmpresa = localStorage.getItem(ACTIVE_EMPRESA_STORAGE_KEY);

  if (!rawActiveEmpresa) {
    return null;
  }

  try {
    return JSON.parse(rawActiveEmpresa);
  } catch {
    localStorage.removeItem(ACTIVE_EMPRESA_STORAGE_KEY);
    return null;
  }
}

function persistActiveEmpresa(activeEmpresa) {
  if (!activeEmpresa) {
    localStorage.removeItem(ACTIVE_EMPRESA_STORAGE_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_EMPRESA_STORAGE_KEY, JSON.stringify(activeEmpresa));
}

function readStoredSession() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);

  if (!token || !rawUser) {
    return {
      token: null,
      user: null,
      activeEmpresa: null
    };
  }

  try {
    const user = normalizeUser(JSON.parse(rawUser));
    const activeEmpresa = resolveActiveEmpresa(user, readStoredActiveEmpresa());
    persistActiveEmpresa(activeEmpresa);

    return {
      token,
      user,
      activeEmpresa
    };
  } catch {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_EMPRESA_STORAGE_KEY);

    return {
      token: null,
      user: null,
      activeEmpresa: null
    };
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [isInitializing, setIsInitializing] = useState(true);
  const currentTokenRef = useRef(session.token);
  const sessionVersionRef = useRef(0);

  const clearSession = useCallback(() => {
    sessionVersionRef.current += 1;
    currentTokenRef.current = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_EMPRESA_STORAGE_KEY);
    configureApiClient();
    setSession({
      token: null,
      user: null,
      activeEmpresa: null
    });
  }, []);

  const saveSession = useCallback((nextSession) => {
    const user = normalizeUser(nextSession.user);
    const hasProvidedActiveEmpresa = Object.prototype.hasOwnProperty.call(nextSession, "activeEmpresa");
    const activeEmpresa = resolveActiveEmpresa(
      user,
      hasProvidedActiveEmpresa ? nextSession.activeEmpresa : readStoredActiveEmpresa()
    );

    sessionVersionRef.current += 1;
    currentTokenRef.current = nextSession.token;
    localStorage.setItem(TOKEN_STORAGE_KEY, nextSession.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    persistActiveEmpresa(activeEmpresa);
    setSession({
      token: nextSession.token,
      user,
      activeEmpresa
    });
  }, []);

  const suspendSession = useCallback(() => {
    sessionVersionRef.current += 1;
    currentTokenRef.current = null;
    configureApiClient();
    setSession({
      token: null,
      user: null,
      activeEmpresa: null
    });
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await loginUser(credentials);

    if (response?.token && response?.user) {
      saveSession({
        token: response.token,
        user: response.user,
        activeEmpresa: normalizeEmpresas(response.user.empresas)[0] || null
      });
    }

    return response;
  }, [saveSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const setActiveEmpresa = useCallback((empresaOrId) => {
    setSession((current) => {
      const empresas = normalizeEmpresas(current.user?.empresas);
      const nextEmpresaId = Number(
        typeof empresaOrId === "object" ? empresaOrId?.id : empresaOrId
      );
      const nextActiveEmpresa = empresas.find((empresa) => empresa.id === nextEmpresaId) || empresas[0] || null;

      persistActiveEmpresa(nextActiveEmpresa);

      return {
        ...current,
        activeEmpresa: nextActiveEmpresa
      };
    });
  }, []);

  useEffect(() => {
    configureApiClient({
      getToken: () => currentTokenRef.current,
      getActiveEmpresaId: () => session.activeEmpresa?.id || null,
      onUnauthorized: (_error, requestContext) => {
        if (requestContext?.token === currentTokenRef.current) {
          clearSession();
        }
      }
    });
  }, [clearSession, session.activeEmpresa?.id, session.token]);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!session.token) {
        setIsInitializing(false);
        return;
      }

      const restorationVersion = sessionVersionRef.current;

      try {
        const response = await getCurrentUser();

        if (
          active
          && restorationVersion === sessionVersionRef.current
          && response?.user
        ) {
          saveSession({
            token: session.token,
            user: response.user,
            activeEmpresa: readStoredActiveEmpresa()
          });
        }
      } catch (error) {
        if (active && restorationVersion === sessionVersionRef.current) {
          if (error instanceof ApiError && error.status === 401) {
            clearSession();
          } else {
            suspendSession();
          }
        }
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
    // A restauracao deve ocorrer uma vez para o token encontrado na inicializacao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        event.key !== TOKEN_STORAGE_KEY
        && event.key !== USER_STORAGE_KEY
        && event.key !== ACTIVE_EMPRESA_STORAGE_KEY
      ) {
        return;
      }

      const storedSession = readStoredSession();
      sessionVersionRef.current += 1;
      currentTokenRef.current = storedSession.token;
      setSession(storedSession);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(() => ({
    user: session.user,
    empresas: normalizeEmpresas(session.user?.empresas),
    activeEmpresa: session.activeEmpresa,
    token: session.token,
    isAuthenticated: Boolean(session.token),
    isInitializing,
    setActiveEmpresa,
    login,
    logout,
    clearSession
  }), [clearSession, isInitializing, login, logout, session.activeEmpresa, session.token, session.user, setActiveEmpresa]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
