export function filterEmpresas(empresas, search = '', status = 'todas') {
  const term = search.trim().toLocaleLowerCase('pt-BR');
  return (Array.isArray(empresas) ? empresas : []).filter((empresa) => {
    const matchesStatus = status === 'todas'
      || (status === 'ativas' && empresa.ativo !== false)
      || (status === 'inativas' && empresa.ativo === false);
    const matchesTerm = !term || [empresa.codigo, empresa.nome]
      .some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
    return matchesStatus && matchesTerm;
  });
}
