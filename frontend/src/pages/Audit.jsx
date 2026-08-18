import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import BackButton from "../components/BackButton";
import FeedbackState from "../components/FeedbackState";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import FormField from "../components/ui/FormField";
import FilterPanel from "../components/ui/FilterPanel";
import StatusPill from "../components/ui/StatusPill";
import Button from "../components/ui/Button";
import { getAuditLogs, getErrorMessage } from "../services/api";
import { displayAuditValue, formatAuditDate, getSafeMetadataEntries } from "../utils/audit";
import "../styles/app-pages.css";
import "../styles/audit.css";

const EMPTY = { search: "", action: "", entity_type: "", empresa_id: "", date_from: "", date_to: "" };
const labels = { "oc.created": "OC criada", "oc.approved": "OC aprovada", "oc.sent_to_recount": "Recontagem solicitada", "oc.finalized": "Contagem finalizada", "user.created": "Usuário criado", "user.updated": "Usuário alterado", "user.deactivated": "Usuário desativado", "user.reactivated": "Usuário reativado", "user.deleted": "Usuário excluído" };

function Metadata({ value }) {
  const entries = getSafeMetadataEntries(value);
  if (!entries.length) return <p className="audit-metadata-empty">Sem detalhes adicionais.</p>;
  return <dl className="audit-metadata">{entries.map(([key, item]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{displayAuditValue(item)}</dd></div>)}</dl>;
}

function Audit() {
  const [filters, setFilters] = useState(EMPTY), [applied, setApplied] = useState(EMPTY);
  const [data, setData] = useState({ items: [], page: 1, pages: 0, total: 0 });
  const [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError("");
    try { const result = await getAuditLogs({ ...applied, page, limit: 25 }); if (version === requestVersion.current) setData(result); }
    catch (err) { if (version === requestVersion.current) setError(getErrorMessage(err, "Não foi possível carregar a auditoria.")); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [applied, page]);
  useEffect(() => { load(); }, [load]);
  const change = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });

  return <Layout><main className="page-shell audit-page"><BackButton to="/dashboard" /><PageHeader level={1} title="Auditoria" subtitle="Consulte as ações administrativas registradas no sistema." />
    <FilterPanel as="form" className="audit-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied(filters); }}>
      <FormField label="Busca" htmlFor="audit-search"><input id="audit-search" className="field-control" value={filters.search} onChange={change("search")} placeholder="Usuário, ação ou registro" /></FormField><FormField label="Ação" htmlFor="audit-action"><input id="audit-action" className="field-control" value={filters.action} onChange={change("action")} placeholder="Ex.: oc.approved" /></FormField><FormField label="Recurso" htmlFor="audit-resource"><input id="audit-resource" className="field-control" value={filters.entity_type} onChange={change("entity_type")} placeholder="Ex.: oc ou user" /></FormField><FormField label="Empresa" htmlFor="audit-company"><input id="audit-company" className="field-control" type="number" min="1" value={filters.empresa_id} onChange={change("empresa_id")} placeholder="ID da empresa" /></FormField><FormField label="De" htmlFor="audit-from"><input id="audit-from" className="field-control" type="date" value={filters.date_from} onChange={change("date_from")} /></FormField><FormField label="Até" htmlFor="audit-to"><input id="audit-to" className="field-control" type="date" value={filters.date_to} onChange={change("date_to")} /></FormField>
      <div className="audit-filter-actions"><Button type="submit">Aplicar filtros</Button><Button variant="secondary" type="button" onClick={() => { setFilters(EMPTY); setApplied(EMPTY); setPage(1); }}>Limpar filtros</Button></div>
    </FilterPanel>
    {loading ? <FeedbackState type="loading" title="Carregando auditoria" message="Buscando os eventos administrativos registrados." /> : error ? <div className="audit-error"><FeedbackState type="error" title="Não foi possível carregar a auditoria" message={error} /><Button variant="secondary" type="button" onClick={load}>Tentar novamente</Button></div> : !data.items.length ? <FeedbackState title="Nenhum evento encontrado" message="Ajuste os filtros ou aguarde o registro de novas ações administrativas." /> : <><p className="audit-total" role="status">{data.total} evento(s) encontrado(s)</p><div className="audit-list">{data.items.map((item) => <Panel as="article" className="audit-card" key={item.id}>
      <header className="audit-card-header"><div><StatusPill variant="info">{labels[item.action] || item.action}</StatusPill><p className="audit-action-code">{item.action}</p></div><time dateTime={item.created_at || undefined}>{formatAuditDate(item.created_at)}</time></header>
      <dl className="audit-summary"><div><dt>Ator</dt><dd>{item.user_name || `Usuário #${item.user_id || "removido"}`}</dd></div><div><dt>Recurso</dt><dd>{item.entity_type} #{item.entity_id || "—"}</dd></div><div><dt>Empresa</dt><dd>{item.empresa_name || item.metadata?.empresa_id || "Global"}</dd></div></dl>
      <details className="audit-details"><summary>Detalhes do evento</summary><Metadata value={item.metadata} /></details>
    </Panel>)}</div><nav className="audit-pagination" aria-label="Paginação da auditoria"><Button variant="secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {data.page} de {Math.max(data.pages, 1)}</span><Button variant="secondary" type="button" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Próxima</Button></nav></>}
  </main></Layout>;
}
export default Audit;
