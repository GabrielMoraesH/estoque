import { filterEmpresas } from './empresas';

const empresas = [
  { codigo: 'DIMEBRAS_PR', nome: 'Dimebras Parana', ativo: true },
  { codigo: 'ALFAMED_MS', nome: 'Alfamed', ativo: false }
];

test('combina busca normalizada e filtro de status', () => {
  expect(filterEmpresas(empresas, '  dimebras ', 'ativas')).toEqual([empresas[0]]);
  expect(filterEmpresas(empresas, 'ALFAMED', 'ativas')).toEqual([]);
  expect(filterEmpresas(empresas, '', 'inativas')).toEqual([empresas[1]]);
});
