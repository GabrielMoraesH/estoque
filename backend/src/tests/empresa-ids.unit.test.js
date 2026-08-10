const { EMPRESAS_FIXAS } = require('../modules/empresas/empresaConstants');
const { createInMemoryUserRepository } = require('../modules/users/in-memory-user.repository');

const expectedEmpresaIds = {
  DIMEBRAS_PR: 1,
  ALFAMED_MS: 2,
  DIMEBRAS_MT: 3,
  DIMEBRAS_MS: 5,
  DIMEBRAS_SC: 6
};

describe('IDs fixos de empresas', () => {
  it('mapeia codigo para ID sem depender da ordem do array', () => {
    const idsByCodigo = Object.fromEntries(
      EMPRESAS_FIXAS.map((empresa) => [empresa.codigo, empresa.id])
    );

    expect(idsByCodigo).toEqual(expectedEmpresaIds);
  });

  it('nao utiliza ID 4 para empresa fixa', () => {
    expect(EMPRESAS_FIXAS.some((empresa) => empresa.id === 4)).toBe(false);
  });

  it('mantem o mesmo mapa no repository em memoria', async () => {
    const repository = createInMemoryUserRepository({
      users: [
        {
          id: 10,
          nome: 'Usuario',
          login: 'usuario',
          senha: 'hash',
          role: 'gestor',
          empresas: EMPRESAS_FIXAS.map((empresa) => ({ ...empresa }))
        }
      ]
    });

    const empresas = await repository.listActiveEmpresasByUserId(10);
    const idsByCodigo = Object.fromEntries(empresas.map((empresa) => [empresa.codigo, empresa.id]));

    expect(idsByCodigo).toEqual(expectedEmpresaIds);
    expect(empresas.some((empresa) => empresa.id === 4)).toBe(false);
  });
});
