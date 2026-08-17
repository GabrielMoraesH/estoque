import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import FeedbackState from '../components/FeedbackState';
import BackButton from '../components/BackButton';
import PageHeader from '../components/ui/PageHeader';
import { useToast } from '../components/ToastProvider';
import usePermissions from '../hooks/usePermissions';
import { createEmpresa, getAdminEmpresas, getErrorMessage, updateEmpresa, updateEmpresaStatus } from '../services/api';
import { filterEmpresas } from '../utils/empresas';
import '../styles/app-pages.css';
import '../styles/empresas.css';

const EMPTY = { codigo: '', nome: '' };

function Empresas() {
  const { canManageEmpresas } = usePermissions();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todas');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await getAdminEmpresas()); }
    catch (err) { setError(getErrorMessage(err, 'Nao foi possivel carregar as empresas.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (canManageEmpresas) load(); }, [canManageEmpresas, load]);
  const visible = useMemo(() => filterEmpresas(items, search, status), [items, search, status]);

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try {
      const saved = editing ? await updateEmpresa(editing.id, { nome: form.nome }) : await createEmpresa(form);
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? { ...item, ...saved } : item) : [...current, { ...saved, usuarios_count: 0, ocs_count: 0 }]);
      showToast(editing ? 'Empresa atualizada com sucesso.' : 'Empresa criada com sucesso.');
      setEditing(null); setForm(EMPTY);
    } catch (err) { showToast(getErrorMessage(err, 'Nao foi possivel salvar a empresa.'), 'error'); }
    finally { lock.current = false; setSaving(false); }
  }

  async function changeStatus(empresa) {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try {
      const saved = await updateEmpresaStatus(empresa.id, empresa.ativo === false);
      setItems((current) => current.map((item) => item.id === saved.id ? { ...item, ...saved } : item));
      showToast(saved.ativo ? 'Empresa reativada com sucesso.' : 'Empresa inativada com sucesso.');
    } catch (err) { showToast(getErrorMessage(err, 'Nao foi possivel alterar o status.'), 'error'); }
    finally { lock.current = false; setSaving(false); }
  }

  if (!canManageEmpresas) return <Navigate to="/dashboard" replace />;
  return <Layout><main className="page-shell empresas-page">
    <BackButton to="/dashboard" />
    <PageHeader level={1} title="Empresas" subtitle="Gerencie filiais, dados administrativos e disponibilidade operacional." />
    <form className="panel-card empresas-form" onSubmit={submit}>
      <div className="field-group"><label htmlFor="empresa-codigo">Codigo</label><input id="empresa-codigo" className="field-control" maxLength="40" required disabled={Boolean(editing) || saving} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
      <div className="field-group"><label htmlFor="empresa-nome">Nome</label><input id="empresa-nome" className="field-control" maxLength="120" required disabled={saving} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
      <div className="empresas-form-actions">{editing && <button type="button" className="secondary-button" disabled={saving} onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancelar</button>}<button className="primary-button" disabled={saving || !form.nome.trim() || (!editing && !form.codigo.trim())}>{saving ? 'Salvando...' : editing ? 'Salvar alteracao' : 'Criar empresa'}</button></div>
    </form>
    <section className="panel-card">
      <div className="empresas-filters"><div className="field-group"><label htmlFor="empresa-search">Buscar</label><input id="empresa-search" className="field-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Codigo ou nome" /></div><div className="field-group"><label htmlFor="empresa-status">Status</label><select id="empresa-status" className="field-control" value={status} onChange={(e) => setStatus(e.target.value)}><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select></div></div>
      {loading ? <FeedbackState type="loading" title="Carregando empresas" /> : error ? <FeedbackState type="error" title="Falha ao carregar" message={error} /> : items.length === 0 ? <FeedbackState title="Nenhuma empresa cadastrada" /> : visible.length === 0 ? <FeedbackState title="Nenhum resultado" message="Ajuste a busca ou o filtro." /> : <div className="empresas-table-wrap"><table className="empresas-table"><thead><tr><th>Codigo</th><th>Nome</th><th>Status</th><th>Usuarios</th><th>OCs</th><th>Criada em</th><th>Acoes</th></tr></thead><tbody>{visible.map((empresa) => <tr key={empresa.id}><td data-label="Codigo">{empresa.codigo}</td><td data-label="Nome">{empresa.nome}</td><td data-label="Status"><span className={`status-pill ${empresa.ativo === false ? 'inactive' : 'active'}`}>{empresa.ativo === false ? 'Inativa' : 'Ativa'}</span></td><td data-label="Usuarios">{empresa.usuarios_count ?? 0}</td><td data-label="OCs">{empresa.ocs_count ?? 0}</td><td data-label="Criada">{empresa.created_at ? new Date(empresa.created_at).toLocaleDateString('pt-BR') : '-'}</td><td data-label="Acoes"><div className="empresas-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => { setEditing(empresa); setForm({ codigo: empresa.codigo, nome: empresa.nome }); }}>Editar</button><button type="button" className="secondary-button" disabled={saving} onClick={() => changeStatus(empresa)}>{empresa.ativo === false ? 'Reativar' : 'Inativar'}</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </main></Layout>;
}
export default Empresas;
