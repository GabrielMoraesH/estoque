export function buildOcExportFilters({ search, status } = {}) {
  const filters = {};
  const normalizedSearch = String(search || '').trim();
  if (normalizedSearch) filters.search = normalizedSearch;
  if (status && status !== 'todas') filters.status = status;
  return filters;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
