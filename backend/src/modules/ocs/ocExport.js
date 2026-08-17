const CSV_HEADERS = ['OC', 'Código da OC', 'Filial', 'Criado por', 'Responsável operacional', 'Status operacional', 'Quantidade de produtos', 'Progresso', 'Criada em', 'Última movimentação', 'Ciclo atual', 'Fase operacional'];

function protectCsvFormula(value) {
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  let text = '';
  if (value !== null && value !== undefined) {
    try { text = typeof value === 'object' ? JSON.stringify(value) : String(value); }
    catch { text = '[unserializable object]'; }
  }
  return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function getOperationalExportStatus(oc) {
  const status = String(oc?.status || 'aberta').toLowerCase();
  if (status === 'finalizada') return 'finalizada';
  if ((oc?.assignment_fase === 'recontagem' && oc?.assignment_status === 'ativo')
    || oc?.has_legacy_recount || ['recontar', 'recontagem'].includes(status)) return 'em_recontagem';
  if (status === 'aguardando_aprovacao') return 'aguardando_aprovacao';
  return 'em_contagem';
}

function filterExportRows(rows, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('pt-BR');
  const from = filters.date_from ? new Date(`${filters.date_from}T00:00:00.000Z`) : null;
  const toExclusive = filters.date_to ? new Date(`${filters.date_to}T00:00:00.000Z`) : null;
  if (toExclusive) toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  return rows.filter((row) => {
    const createdAt = row.created_at ? new Date(row.created_at) : null;
    return (!filters.status || getOperationalExportStatus(row) === filters.status)
      && (!filters.creator_id || Number(row.gestor_id) === Number(filters.creator_id))
      && (!filters.responsible_id || Number(row.responsavel_atual_id || row.estoquista_id) === Number(filters.responsible_id))
      && (!from || (createdAt && createdAt >= from)) && (!toExclusive || (createdAt && createdAt < toExclusive))
      && (!search || [row.id, row.codigo].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(search));
  });
}

function escapeCsvValue(value) { return `"${protectCsvFormula(value).replace(/"/g, '""')}"`; }
function serializeCsv(rows) { return `\uFEFF${[CSV_HEADERS, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')}`; }
function safeFilenamePart(value, fallback = 'EMPRESA') {
  const safe = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
  return safe || fallback;
}

module.exports = { CSV_HEADERS, escapeCsvValue, filterExportRows, getOperationalExportStatus, protectCsvFormula, safeFilenamePart, serializeCsv };
