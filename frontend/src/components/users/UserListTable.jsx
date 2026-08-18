import { memo, useCallback, useMemo, useState } from "react";
import DataState from "../ui/DataState";
import Panel from "../ui/Panel";
import TableContainer from "../ui/TableContainer";
import FilterPanel from "../ui/FilterPanel";
import FormField from "../ui/FormField";
import StatusPill from "../ui/StatusPill";

const ROLE_LABELS = {
  admin: "Admin",
  gestor: "Gestor",
  estoquista: "Estoquista"
};

const EMPTY_USER = {};

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M14.7 5.3l4 4L8.9 19H5v-3.9l9.7-9.8z" />
      <path d="M16.1 3.9a1.9 1.9 0 0 1 2.7 0l1.3 1.3a1.9 1.9 0 0 1 0 2.7l-.7.7-4-4 .7-.7z" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3v9" />
      <path d="M7 5.9a8 8 0 1 0 10 0" />
    </svg>
  );
}

function formatCreatedAt(user) {
  const value = user?.created_at || user?.createdAt || user?.criado_em || user?.created;

  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function getUserStatus(user) {
  if (typeof user?.ativo === "boolean") {
    return user.ativo ? "active" : "inactive";
  }

  if (typeof user?.active === "boolean") {
    return user.active ? "active" : "inactive";
  }

  return "active";
}

function getCompanySummary(empresas) {
  const safeEmpresas = Array.isArray(empresas) ? empresas.filter(Boolean) : [];
  const names = safeEmpresas
    .map((empresa) => empresa?.nome)
    .filter(Boolean);

  if (names.length === 0) {
    return {
      label: "Sem empresa",
      title: "Nenhuma empresa vinculada"
    };
  }

  if (names.length === 1) {
    return {
      label: names[0],
      title: names[0]
    };
  }

  if (names.length <= 3) {
    return {
      label: `${names[0]} +${names.length - 1}`,
      title: names.join(", ")
    };
  }

  return {
    label: `${names.length} empresas`,
    title: names.join(", ")
  };
}

function UserActionButton({ children, label, variant = "primary", disabled, onClick }) {
  return (
    <button
      className={`users-icon-button users-icon-button-${variant}`}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const UserTableRow = memo(function UserTableRow({
  user,
  statusSavingId,
  onRequestEdit,
  onRequestStatusChange
}) {
  const safeUser = user || EMPTY_USER;
  const status = getUserStatus(safeUser);
  const companySummary = useMemo(() => getCompanySummary(safeUser.empresas), [safeUser.empresas]);
  const isStatusSaving = statusSavingId === safeUser.id;

  const handleEdit = useCallback(() => {
    onRequestEdit(safeUser);
  }, [onRequestEdit, safeUser]);

  const handleStatusChange = useCallback(() => {
    onRequestStatusChange(safeUser);
  }, [onRequestStatusChange, safeUser]);

  return (
    <tr>
      <td data-label="Nome">
        <div className="users-user-cell">
          <strong>{safeUser.nome || "-"}</strong>
        </div>
      </td>

      <td data-label="Login">
        <span className="users-muted-text">{safeUser.login || "-"}</span>
      </td>

      <td data-label="Perfil">
        <span className="users-profile-badge">{ROLE_LABELS[safeUser.role] || "Perfil"}</span>
      </td>

      <td data-label="Nível">
        {safeUser.role === "estoquista" && safeUser.nivel_estoquista ? (
          <span className="users-level-badge">Nível {safeUser.nivel_estoquista}</span>
        ) : (
          <span className="users-muted-text">-</span>
        )}
      </td>

      <td data-label="Empresas">
        <span className="users-company-badge" title={companySummary.title}>
          {companySummary.label}
        </span>
      </td>

      <td data-label="Status">
        <StatusPill variant={status === "active" ? "success" : "neutral"}>
          {status === "active" ? "Ativo" : "Inativo"}
        </StatusPill>
      </td>

      <td data-label="Criado em">
        <span className="users-muted-text">{formatCreatedAt(safeUser)}</span>
      </td>

      <td data-label="Ações">
        <div className="users-row-actions">
          <UserActionButton label={`Editar ${safeUser.nome || "usuario"}`} onClick={handleEdit}>
            <EditIcon />
          </UserActionButton>

          <UserActionButton
            label={`${status === "active" ? "Desativar" : "Reativar"} ${safeUser.nome || "usuario"}`}
            variant={status === "active" ? "danger" : "success"}
            disabled={isStatusSaving}
            onClick={handleStatusChange}
          >
            <PowerIcon />
          </UserActionButton>
        </div>
      </td>
    </tr>
  );
});

function UserListTable({
  loading,
  error,
  users,
  statusSavingId,
  onRequestEdit,
  onRequestStatusChange
}) {
  const safeUsers = useMemo(
    () => (Array.isArray(users) ? users.filter(Boolean) : []),
    [users]
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");

    return safeUsers.filter((user) => {
      const matchesSearch = !term || [user.nome, user.login]
        .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(term));
      const status = getUserStatus(user);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [roleFilter, safeUsers, search, statusFilter]);

  return (
    <Panel
      className="users-list-card"
      title="Usuários cadastrados"
      subtitle="Gerencie perfis, empresas de acesso e credenciais sem poluir a listagem principal."
      headerClassName="users-list-header"
    >
      {!loading && !error && safeUsers.length > 0 && (
        <FilterPanel className="users-filters" role="search" aria-label="Buscar e filtrar usuários">
          <FormField className="users-search-field" label="Buscar por nome ou login" htmlFor="users-search">
            <input
              id="users-search"
              type="search"
              value={search}
              placeholder="Digite um nome ou login"
              onChange={(event) => setSearch(event.target.value)} className="field-control"
            />
          </FormField>
          <FormField label="Status" htmlFor="users-status-filter">
            <select className="field-control" id="users-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </FormField>
          <FormField label="Perfil" htmlFor="users-role-filter">
            <select className="field-control" id="users-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="admin">Admin</option>
              <option value="gestor">Gestor</option>
              <option value="estoquista">Estoquista</option>
            </select>
          </FormField>
        </FilterPanel>
      )}
      <DataState
        loading={loading}
        error={error}
        empty={safeUsers.length === 0 || filteredUsers.length === 0}
        loadingTitle="Carregando usuários"
        loadingMessage="Buscando a lista de acessos cadastrados."
        errorTitle="Não foi possível carregar os usuários"
        emptyTitle={safeUsers.length === 0 ? "Nenhum usuário cadastrado" : "Nenhum usuário encontrado"}
        emptyMessage={safeUsers.length === 0
          ? "Quando novos gestores ou estoquistas forem criados, eles aparecerao aqui."
          : "Ajuste a busca ou os filtros para ver outros usuarios."}
        panel={false}
      >
        <TableContainer className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th scope="col">Nome</th><th scope="col">Login</th><th scope="col">Perfil</th><th scope="col">Nível</th><th scope="col">Empresas</th><th scope="col">Status</th><th scope="col">Criado em</th><th scope="col">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  statusSavingId={statusSavingId}
                  onRequestEdit={onRequestEdit}
                  onRequestStatusChange={onRequestStatusChange}
                />
              ))}
            </tbody>
          </table>
        </TableContainer>
      </DataState>
    </Panel>
  );
}

export default memo(UserListTable);
