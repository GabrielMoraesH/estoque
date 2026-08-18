import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import FeedbackState from '../components/FeedbackState';
import BackButton from '../components/BackButton';
import PageHeader from '../components/ui/PageHeader';
import Panel from '../components/ui/Panel';
import FormField from '../components/ui/FormField';
import FilterPanel from '../components/ui/FilterPanel';
import TableContainer from '../components/ui/TableContainer';
import StatusPill from '../components/ui/StatusPill';
import Button from '../components/ui/Button';
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
    <Panel as="form" className="empresas-form" onSubmit={submit}>
      <FormField label="Código" htmlFor="empresa-codigo" required><input id="empresa-codigo" className="field-control" maxLength="40" required disabled={Boolean(editing) || saving} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></FormField>
      <FormField label="Nome" htmlFor="empresa-nome" required><input id="empresa-nome" className="field-control" maxLength="120" required disabled={saving} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></FormField>
      <div className="empresas-form-actions">{editing && <Button type="button" variant="secondary" disabled={saving} onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancelar</Button>}<Button disabled={saving || !form.nome.trim() || (!editing && !form.codigo.trim())}>{saving ? 'Salvando...' : editing ? 'Salvar alteração' : 'Criar empresa'}</Button></div>
    </Panel>
    <Panel>
      <FilterPanel className="empresas-filters"><FormField label="Buscar" htmlFor="empresa-search"><input id="empresa-search" className="field-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código ou nome" /></FormField><FormField label="Status" htmlFor="empresa-status"><select id="empresa-status" className="field-control" value={status} onChange={(e) => setStatus(e.target.value)}><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select></FormField></FilterPanel>
      {loading ? <FeedbackState type="loading" title="Carregando empresas" /> : error ? <FeedbackState type="error" title="Falha ao carregar" message={error} /> : items.length === 0 ? <FeedbackState title="Nenhuma empresa cadastrada" /> : visible.length === 0 ? <FeedbackState title="Nenhum resultado" message="Ajuste a busca ou o filtro." /> : <TableContainer className="empresas-table-wrap"><table className="empresas-table"><thead><tr><th scope="col">Código</th><th scope="col">Nome</th><th scope="col">Status</th><th scope="col">Usuários</th><th scope="col">OCs</th><th scope="col">Criada em</th><th scope="col">Ações</th></tr></thead><tbody>{visible.map((empresa) => <tr key={empresa.id}><td data-label="Código">{empresa.codigo}</td><td data-label="Nome">{empresa.nome}</td><td data-label="Status"><StatusPill variant={empresa.ativo === false ? 'neutral' : 'success'}>{empresa.ativo === false ? 'Inativa' : 'Ativa'}</StatusPill></td><td data-label="Usuários">{empresa.usuarios_count ?? 0}</td><td data-label="OCs">{empresa.ocs_count ?? 0}</td><td data-label="Criada">{empresa.created_at ? new Date(empresa.created_at).toLocaleDateString('pt-BR') : '-'}</td><td data-label="Ações"><div className="empresas-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => { setEditing(empresa); setForm({ codigo: empresa.codigo, nome: empresa.nome }); }}>Editar</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => changeStatus(empresa)}>{empresa.ativo === false ? 'Reativar' : 'Inativar'}</Button></div></td></tr>)}</tbody></table></TableContainer>}
    </Panel>
  </main></Layout>;
}
export default Empresas;
