import { configureApiClient, requestJson } from './api';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' }, json: async () => body };
}

describe('revalidacao empresarial do cliente HTTP', () => {
  afterEach(() => { configureApiClient(); jest.restoreAllMocks(); });

  it.each([
    [404, 'Empresa nao encontrada'],
    [403, 'Usuario nao tem acesso a esta empresa']
  ])('revalida somente o contrato empresarial %s', async (status, message) => {
    const onInvalidEmpresa = jest.fn();
    configureApiClient({ getToken: () => 'token', getActiveEmpresaId: () => 7, onInvalidEmpresa });
    jest.spyOn(global, 'fetch').mockResolvedValue(response(status, { error: { message } }));
    await expect(requestJson('/ocs/dashboard', { authenticated: true })).rejects.toMatchObject({ status });
    expect(onInvalidEmpresa).toHaveBeenCalledWith(expect.any(Error), { token: 'token' });
  });

  it('nao revalida em 403 de RBAC', async () => {
    const onInvalidEmpresa = jest.fn();
    configureApiClient({ getToken: () => 'token', getActiveEmpresaId: () => 7, onInvalidEmpresa });
    jest.spyOn(global, 'fetch').mockResolvedValue(response(403, { error: { message: 'Voce nao tem permissao' } }));
    await expect(requestJson('/empresas/admin', { authenticated: true })).rejects.toMatchObject({ status: 403 });
    expect(onInvalidEmpresa).not.toHaveBeenCalled();
  });

  it('nao envia x-empresa-id quando empresa ativa e nula', async () => {
    configureApiClient({ getToken: () => 'token', getActiveEmpresaId: () => null });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response(200, {}));
    await requestJson('/auth/me', { authenticated: true });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('x-empresa-id');
  });
});
