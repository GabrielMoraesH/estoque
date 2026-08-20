const {
  getOperationalExportStatus,
  safeFilenamePart,
  serializeCsv
} = require('../ocExport');

const EXPORT_LIMIT = 2000;
const EXPORT_STATUS_LABELS = {
  em_contagem: 'Em contagem',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_recontagem: 'Em recontagem',
  finalizada: 'Finalizada'
};

function toExportCsvRow(oc) {
  const status = getOperationalExportStatus(oc);
  const total = Number(oc.total_localizacoes || 0);
  const counted = Number(oc.localizacoes_contadas || 0);
  return [oc.id, oc.codigo, oc.empresa_nome || oc.empresa_codigo, oc.criador_nome, oc.estoquista_nome,
    EXPORT_STATUS_LABELS[status], Number(oc.qtd || 0), status === 'finalizada' ? 'Concluída' : `${counted}/${total} localizações`,
    oc.created_at ? new Date(oc.created_at).toISOString() : '', oc.ultima_movimentacao_em ? new Date(oc.ultima_movimentacao_em).toISOString() : '',
    oc.assignment_ciclo, oc.assignment_fase];
}

function createOcExportService({
  repository,
  audit,
  csvSerializer = serializeCsv,
  isAdmin,
  isGestor,
  forbidden,
  badRequest
}) {
  async function exportOcsCsv({ user, empresaId, empresa, filters = {}, auditContext }) {
    if (!isAdmin(user) && !isGestor(user)) throw forbidden('Voce nao tem permissao para exportar OCs');
    const rows = await repository.listByGestor({ empresaId, exportFilters: filters, limit: EXPORT_LIMIT + 1 });
    if (rows.length > EXPORT_LIMIT) throw badRequest(`A exportacao excede o limite de ${EXPORT_LIMIT} OCs. Restrinja os filtros.`);
    const csv = csvSerializer(rows.map(toExportCsvRow));
    const date = new Date().toISOString().slice(0, 10);
    const filename = `ocs-${safeFilenamePart(empresa?.codigo || empresa?.nome)}-${date}.csv`;
    await audit.logAction({ user, action: 'oc.exported', entityType: 'oc_export', metadata: { empresa_id: empresaId, formato: 'csv', filtros: filters, quantidade_registros: rows.length }, auditContext });
    return { csv, filename, count: rows.length };
  }

  return { exportOcsCsv };
}

module.exports = { createOcExportService, EXPORT_LIMIT, toExportCsvRow };
