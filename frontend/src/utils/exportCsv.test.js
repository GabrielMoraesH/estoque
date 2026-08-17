import { buildOcExportFilters } from './exportCsv';

describe('filtros da exportação de OCs', () => {
  it('envia busca normalizada e status visível', () => {
    expect(buildOcExportFilters({ search: '  OC-10 ', status: 'em_recontagem' })).toEqual({ search: 'OC-10', status: 'em_recontagem' });
  });
  it('omite filtros vazios e status todas', () => {
    expect(buildOcExportFilters({ search: ' ', status: 'todas' })).toEqual({});
  });
});
