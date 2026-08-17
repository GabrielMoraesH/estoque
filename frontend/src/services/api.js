import { isAdmin, isGestor } from "../utils/permissions";

const API_URL = process.env.REACT_APP_API_URL;

let authTokenProvider = () => null;
let activeEmpresaIdProvider = () => null;
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, { status, data, path } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    this.data = data ?? null;
    this.path = path ?? "";
  }
}

export function configureApiClient({ getToken, getActiveEmpresaId, onUnauthorized } = {}) {
  authTokenProvider = typeof getToken === "function" ? getToken : () => null;
  activeEmpresaIdProvider = typeof getActiveEmpresaId === "function" ? getActiveEmpresaId : () => null;
  unauthorizedHandler = typeof onUnauthorized === "function" ? onUnauthorized : null;
}

function getToken() {
  return authTokenProvider();
}

function createHeaders({ authenticated = false, json = false, headers = {} } = {}) {
  const nextHeaders = { ...headers };
  const token = authenticated ? getToken() : null;

  if (json && !nextHeaders["Content-Type"]) {
    nextHeaders["Content-Type"] = "application/json";
  }

  if (authenticated && token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  const activeEmpresaId = activeEmpresaIdProvider();

  if (authenticated && activeEmpresaId && !nextHeaders["x-empresa-id"]) {
    nextHeaders["x-empresa-id"] = String(activeEmpresaId);
  }

  return nextHeaders;
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

function getStatusFallbackMessage(status) {
  switch (status) {
    case 401:
      return "Sessao invalida ou expirada. Faca login novamente.";
    case 403:
      return "Você não tem permissão para realizar esta ação.";
    case 404:
      return "Recurso não encontrado.";
    case 500:
      return "Erro interno do servidor. Tente novamente em instantes.";
    default:
      return "Não foi possível concluir a requisição.";
  }
}

function resolveErrorMessage(status, data) {
  if (data && typeof data === "object") {
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (
      data.error
      && typeof data.error === "object"
      && typeof data.error.message === "string"
      && data.error.message.trim()
    ) {
      return data.error.message;
    }

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
  }

  return getStatusFallbackMessage(status);
}

export function getErrorMessage(error, fallbackMessage) {
  if (error instanceof ApiError) {
    return error.message || fallbackMessage || getStatusFallbackMessage(error.status);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage || "Ocorreu um erro inesperado.";
}

export async function requestJson(
  path,
  {
    method = "GET",
    body,
    authenticated = false,
    headers,
    onUnauthorized
  } = {}
) {
  let response;
  const requestHeaders = createHeaders({
    authenticated,
    json: body !== undefined,
    headers
  });
  const requestToken = requestHeaders.Authorization?.replace(/^Bearer\s+/, '') || null;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor.", {
      status: 0,
      path
    });
  }

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const error = new ApiError(resolveErrorMessage(response.status, data), {
      status: response.status,
      data,
      path
    });

    if (authenticated && response.status === 401) {
      const handler = typeof onUnauthorized === "function" ? onUnauthorized : unauthorizedHandler;
      handler?.(error, { token: requestToken });
    }

    throw error;
  }

  return data;
}

export async function registerUser(data) {
  return requestJson("/users/register", {
    method: "POST",
    body: data,
    authenticated: true
  });
}

export async function loginUser(data) {
  return requestJson("/users/login", {
    method: "POST",
    body: data
  });
}

export async function getCurrentUser() {
  return requestJson("/auth/me", {
    authenticated: true
  });
}

export async function createOCWithItems(data) {
  return requestJson("/ocs/create-with-items", {
    method: "POST",
    body: data,
    authenticated: true
  });
}

function getOwnOrAdminOcEndpoint({ role, id } = {}, { adminPath, ownPath }) {
  return isAdmin({ role }) && id ? `${adminPath}/${id}` : ownPath;
}

export async function getOCsByGestor({ role, id } = {}) {
  const endpoint = getOwnOrAdminOcEndpoint(
    { role, id },
    {
      adminPath: "/ocs/gestor",
      ownPath: "/ocs/minhas/gestor"
    }
  );

  return requestJson(endpoint, {
    authenticated: true
  });
}

export async function getOcHistoryDetails(ocId) {
  return requestJson(`/ocs/historico/${ocId}`, { authenticated: true });
}

export async function getOCsByEstoquista({ role, id } = {}) {
  const endpoint = getOwnOrAdminOcEndpoint(
    { role, id },
    {
      adminPath: "/ocs/estoquista",
      ownPath: "/ocs/minhas/estoquista"
    }
  );

  return requestJson(endpoint, {
    authenticated: true
  });
}

export async function getEstoquistas({ nivel } = {}) {
  const params = new URLSearchParams();

  if (nivel) {
    params.set("nivel", String(nivel));
  }

  const query = params.toString();

  return requestJson(`/users/estoquistas${query ? `?${query}` : ""}`, {
    authenticated: true
  });
}

export async function getOCsForApproval({ role } = {}) {
  const user = { role };
  const endpoint =
    isAdmin(user) ? "/ocs/aprovacao/admin/all" : isGestor(user) ? "/ocs/aprovacao/minhas" : null;

  if (!endpoint) {
    throw new ApiError("Você não tem permissão para acessar aprovações.", {
      status: 403,
      path: "/ocs/aprovacao"
    });
  }

  return requestJson(endpoint, {
    authenticated: true
  });
}

export async function getDashboardSummary() {
  return requestJson("/ocs/dashboard", {
    authenticated: true
  });
}

export async function getUsers() {
  return requestJson("/users", {
    authenticated: true
  });
}

export async function getEmpresas() {
  return requestJson("/empresas", {
    authenticated: true
  });
}

export async function updateUser(id, data) {
  return requestJson(`/users/${id}`, {
    method: "PUT",
    body: data,
    authenticated: true
  });
}

export async function updateUserStatus(id, data) {
  return requestJson(`/users/${id}/status`, {
    method: "PATCH",
    body: data,
    authenticated: true
  });
}

export async function deleteUser(id) {
  return requestJson(`/users/${id}`, {
    method: "DELETE",
    authenticated: true
  });
}

export async function getItemsByOC(ocId) {
  return requestJson(`/ocs/${ocId}/items`, {
    authenticated: true
  });
}

export async function salvarContagem(data) {
  return requestJson("/ocs/contar", {
    method: "POST",
    body: data,
    authenticated: true
  });
}

export async function finalizarOC(id) {
  return requestJson(`/ocs/${id}/finalizar`, {
    method: "PUT",
    authenticated: true
  });
}

export async function approveOC(id) {
  return requestJson(`/ocs/${id}/aprovar`, {
    method: "PUT",
    authenticated: true
  });
}

export async function sendItemsToRecount(id, itemIds, novoEstoquistaId) {
  return requestJson(`/ocs/${id}/recontagem`, {
    method: "PUT",
    body: {
      itemIds,
      novo_estoquista_id: novoEstoquistaId
    },
    authenticated: true
  });
}
