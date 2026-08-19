import { ApiError, configureApiClient, reassignOcAssignment, requestJson } from "./api";

function response({ status = 200, data, contentType = "application/json", jsonError } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: jest.fn((name) => name === "content-type" ? contentType : null) },
    json: jsonError ? jest.fn().mockRejectedValue(jsonError) : jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(typeof data === "string" ? data : "")
  };
}

describe("api client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    configureApiClient();
  });

  afterEach(() => {
    jest.resetAllMocks();
    configureApiClient();
  });

  it("envia Authorization, empresa ativa e JSON em requisições autenticadas", async () => {
    configureApiClient({ getToken: () => "token-ficticio", getActiveEmpresaId: () => 42 });
    fetch.mockResolvedValue(response({ data: { ok: true } }));

    await expect(requestJson("/teste", { method: "POST", body: { nome: "OC" }, authenticated: true })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/teste"), expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-ficticio", "x-empresa-id": "42" },
      body: JSON.stringify({ nome: "OC" })
    }));
  });

  it("não envia Authorization quando não há token, mas preserva a empresa ativa", async () => {
    configureApiClient({ getActiveEmpresaId: () => 42 });
    fetch.mockResolvedValue(response({ data: { ok: true } }));

    await requestJson("/publico", { authenticated: true });
    expect(fetch.mock.calls[0][1].headers).toEqual({ "x-empresa-id": "42" });
  });

  it("retorna null para 204 e JSON inválido sem transformar respostas de sucesso em erro", async () => {
    fetch.mockResolvedValueOnce(response({ status: 204, data: undefined, contentType: "" }));
    fetch.mockResolvedValueOnce(response({ data: undefined, jsonError: new Error("JSON inválido") }));

    await expect(requestJson("/sem-conteudo")).resolves.toBeNull();
    await expect(requestJson("/json-invalido")).resolves.toBeNull();
  });

  it("normaliza 400 e 500 com mensagem pública e status", async () => {
    fetch.mockResolvedValueOnce(response({ status: 400, data: { error: "Campo obrigatório" } }));
    fetch.mockResolvedValueOnce(response({ status: 500, data: {} }));

    await expect(requestJson("/validacao")).rejects.toMatchObject({ name: "ApiError", status: 400, message: "Campo obrigatório", path: "/validacao" });
    await expect(requestJson("/falha")).rejects.toMatchObject({ name: "ApiError", status: 500, message: "Erro interno do servidor. Tente novamente em instantes." });
  });

  it("trata 401 com o callback de sessão e mantém 403 separado", async () => {
    const onUnauthorized = jest.fn();
    const onInvalidEmpresa = jest.fn();
    configureApiClient({ getToken: () => "token-ficticio", onUnauthorized, onInvalidEmpresa });
    fetch.mockResolvedValueOnce(response({ status: 401, data: { message: "Expirada" } }));
    fetch.mockResolvedValueOnce(response({ status: 403, data: { message: "Usuario nao tem acesso a esta empresa" } }));

    await expect(requestJson("/sessao", { authenticated: true })).rejects.toMatchObject({ status: 401, message: "Expirada" });
    await expect(requestJson("/empresa", { authenticated: true })).rejects.toMatchObject({ status: 403 });
    expect(onUnauthorized).toHaveBeenCalledWith(expect.any(ApiError), { token: "token-ficticio" });
    expect(onInvalidEmpresa).toHaveBeenCalledWith(expect.any(ApiError), { token: "token-ficticio" });
  });

  it("converte falhas de rede em ApiError observável", async () => {
    fetch.mockRejectedValue(new TypeError("offline"));

    await expect(requestJson("/rede")).rejects.toMatchObject({
      name: "ApiError", status: 0, path: "/rede", message: "Não foi possível conectar ao servidor."
    });
  });

  it.each([
    [404, "Empresa nao encontrada"],
    [403, "Usuario nao tem acesso a esta empresa"]
  ])("notifica empresa inválida nos contratos empresariais %s", async (status, message) => {
    const onInvalidEmpresa = jest.fn();
    configureApiClient({ getToken: () => "token-ficticio", getActiveEmpresaId: () => 7, onInvalidEmpresa });
    fetch.mockResolvedValue(response({ status, data: { error: { message } } }));

    await expect(requestJson("/ocs/dashboard", { authenticated: true })).rejects.toMatchObject({ status });
    expect(onInvalidEmpresa).toHaveBeenCalledWith(expect.any(ApiError), { token: "token-ficticio" });
  });

  it("não trata 403 de RBAC como empresa inválida", async () => {
    const onInvalidEmpresa = jest.fn();
    configureApiClient({ getToken: () => "token-ficticio", getActiveEmpresaId: () => 7, onInvalidEmpresa });
    fetch.mockResolvedValue(response({ status: 403, data: { error: { message: "Sem permissão" } } }));

    await expect(requestJson("/empresas/admin", { authenticated: true })).rejects.toMatchObject({ status: 403 });
    expect(onInvalidEmpresa).not.toHaveBeenCalled();
  });

  it("envia reatribuição com empresa ativa e somente o novo responsável", async () => {
    configureApiClient({ getToken: () => "token-ficticio", getActiveEmpresaId: () => 7 });
    fetch.mockResolvedValue(response({ data: { changed: true } }));

    await expect(reassignOcAssignment(10, 500, 33)).resolves.toEqual({ changed: true });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/ocs/10/assignments/500/reassign"), expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ estoquista_id: 33 }),
      headers: expect.objectContaining({ Authorization: "Bearer token-ficticio", "x-empresa-id": "7" })
    }));
  });
});
