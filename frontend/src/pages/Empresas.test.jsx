import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Empresas from './Empresas';
import usePermissions from '../hooks/usePermissions';
import {
  createEmpresa,
  getAdminEmpresas,
  updateEmpresa,
  updateEmpresaStatus
} from '../services/api';

jest.mock('../components/Layout', () => ({ children }) => <main>{children}</main>);
jest.mock('../components/BackButton', () => () => null);
jest.mock('../components/ToastProvider', () => ({ useToast: jest.fn() }));
jest.mock('../hooks/usePermissions', () => jest.fn());
jest.mock('../services/api', () => ({
  ...jest.requireActual('../services/api'),
  createEmpresa: jest.fn(),
  getAdminEmpresas: jest.fn(),
  updateEmpresa: jest.fn(),
  updateEmpresaStatus: jest.fn()
}));
jest.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>
}), { virtual: true });

const { useToast } = require('../components/ToastProvider');

const empresas = [{
  id: 10,
  codigo: 'ALFA',
  nome: 'Empresa Alfa',
  ativo: true,
  usuarios_count: 3,
  ocs_count: 7,
  created_at: '2026-08-01T12:00:00.000Z'
}, {
  id: 20,
  codigo: 'BETA',
  nome: 'Empresa Beta',
  ativo: false,
  usuarios_count: 1,
  ocs_count: 0,
  created_at: null
}];

describe('Empresas', () => {
  let showToast;

  beforeEach(() => {
    jest.clearAllMocks();
    showToast = jest.fn();
    useToast.mockReturnValue({ showToast });
    usePermissions.mockReturnValue({ canManageEmpresas: true });
    getAdminEmpresas.mockResolvedValue(empresas);
    createEmpresa.mockReset();
    updateEmpresa.mockReset();
    updateEmpresaStatus.mockReset();
  });

  it('mantem a tabela oculta durante o loading e encerra apos a resposta', async () => {
    let resolveRequest;
    getAdminEmpresas.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<Empresas />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando empresas');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    resolveRequest(empresas);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lista codigo, nome, status, usuarios, OCs e data', async () => {
    render(<Empresas />);
    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('ALFA');
    expect(table).toHaveTextContent('Empresa Alfa');
    expect(table).toHaveTextContent('Ativa');
    expect(table).toHaveTextContent('3');
    expect(table).toHaveTextContent('7');
    expect(table).toHaveTextContent('01/08/2026');
    expect(table).toHaveTextContent('BETA');
    expect(table).toHaveTextContent('Inativa');
  });

  it('mostra o estado vazio real', async () => {
    getAdminEmpresas.mockResolvedValue([]);
    render(<Empresas />);
    expect(await screen.findByText('Nenhuma empresa cadastrada')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('encerra o loading e mostra o erro da API', async () => {
    getAdminEmpresas.mockRejectedValue(new Error('Empresas indisponiveis'));
    render(<Empresas />);
    expect(await screen.findByText('Empresas indisponiveis')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('busca por codigo e nome e mostra estado sem resultado', async () => {
    render(<Empresas />);
    await screen.findByRole('table');
    const search = screen.getByLabelText('Buscar');
    await userEvent.type(search, 'BETA');
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument();
    expect(screen.queryByText('Empresa Alfa')).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'Alfa');
    expect(screen.getByText('Empresa Alfa')).toBeInTheDocument();
    expect(screen.queryByText('Empresa Beta')).not.toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'inexistente');
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument();
  });

  it('filtra empresas ativas e inativas', async () => {
    render(<Empresas />);
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'inativas');
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument();
    expect(screen.queryByText('Empresa Alfa')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ativas');
    expect(screen.getByText('Empresa Alfa')).toBeInTheDocument();
    expect(screen.queryByText('Empresa Beta')).not.toBeInTheDocument();
  });

  it('cria empresa com payload essencial e atualiza a lista', async () => {
    createEmpresa.mockResolvedValue({ id: 30, codigo: 'GAMA', nome: 'Empresa Gama', ativo: true });
    render(<Empresas />);
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText(/C.digo \*/), 'GAMA');
    await userEvent.type(screen.getByLabelText(/Nome \*/), 'Empresa Gama');
    await userEvent.click(screen.getByRole('button', { name: 'Criar empresa' }));

    await waitFor(() => expect(createEmpresa).toHaveBeenCalledWith({ codigo: 'GAMA', nome: 'Empresa Gama' }));
    expect(await screen.findByText('Empresa Gama')).toBeInTheDocument();
    expect(screen.getByLabelText(/C.digo \*/)).toHaveValue('');
    expect(screen.getByLabelText(/Nome \*/)).toHaveValue('');
  });

  it('mantem criar desabilitado enquanto codigo ou nome obrigatorio esta vazio', async () => {
    render(<Empresas />);
    await screen.findByRole('table');
    const submit = screen.getByRole('button', { name: 'Criar empresa' });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/C.digo \*/), 'GAMA');
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Nome \*/), 'Empresa Gama');
    expect(submit).toBeEnabled();
  });

  it('edita somente o nome e atualiza a linha correspondente', async () => {
    updateEmpresa.mockResolvedValue({ ...empresas[0], nome: 'Alfa Atualizada' });
    render(<Empresas />);
    const alfaRow = await screen.findByRole('row', { name: /ALFA Empresa Alfa/ });
    await userEvent.click(within(alfaRow).getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText(/C.digo \*/)).toHaveValue('ALFA');
    expect(screen.getByLabelText(/C.digo \*/)).toBeDisabled();
    const name = screen.getByLabelText(/Nome \*/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Alfa Atualizada');
    await userEvent.click(screen.getByRole('button', { name: /Salvar altera/ }));

    await waitFor(() => expect(updateEmpresa).toHaveBeenCalledWith(10, { nome: 'Alfa Atualizada' }));
    expect(await screen.findByText('Alfa Atualizada')).toBeInTheDocument();
  });

  it('inativa empresa e atualiza o status visual', async () => {
    updateEmpresaStatus.mockResolvedValue({ ...empresas[0], ativo: false });
    render(<Empresas />);
    const alfaRow = await screen.findByRole('row', { name: /ALFA Empresa Alfa/ });
    await userEvent.click(within(alfaRow).getByRole('button', { name: 'Inativar' }));
    await waitFor(() => expect(updateEmpresaStatus).toHaveBeenCalledWith(10, false));
    await waitFor(() => expect(screen.getAllByText('Inativa')).toHaveLength(2));
  });

  it('bloqueia duplo envio durante criacao pendente', async () => {
    createEmpresa.mockReturnValue(new Promise(() => {}));
    render(<Empresas />);
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText(/C.digo \*/), 'GAMA');
    await userEvent.type(screen.getByLabelText(/Nome \*/), 'Empresa Gama');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Criar empresa' }));
    expect(createEmpresa).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  it('preserva o formulario e permite nova tentativa apos erro de mutacao', async () => {
    createEmpresa.mockRejectedValueOnce(new Error('Codigo ja existe')).mockResolvedValueOnce({
      id: 30, codigo: 'GAMA', nome: 'Empresa Gama', ativo: true
    });
    render(<Empresas />);
    await screen.findByRole('table');
    await userEvent.type(screen.getByLabelText(/C.digo \*/), 'GAMA');
    await userEvent.type(screen.getByLabelText(/Nome \*/), 'Empresa Gama');
    await userEvent.click(screen.getByRole('button', { name: 'Criar empresa' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Codigo ja existe', 'error'));
    expect(screen.getByLabelText(/C.digo \*/)).toHaveValue('GAMA');
    await userEvent.click(screen.getByRole('button', { name: 'Criar empresa' }));
    await waitFor(() => expect(createEmpresa).toHaveBeenCalledTimes(2));
  });

  it('redireciona sem request quando nao possui permissao', () => {
    usePermissions.mockReturnValue({ canManageEmpresas: false });
    render(<Empresas />);
    expect(screen.getByTestId('redirect')).toHaveTextContent('/dashboard');
    expect(getAdminEmpresas).not.toHaveBeenCalled();
  });
});
