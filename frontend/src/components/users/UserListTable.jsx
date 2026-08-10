import { memo, useCallback, useMemo } from "react";
import DataState from "../ui/DataState";
import Panel from "../ui/Panel";
import TableContainer from "../ui/TableContainer";

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

      <td data-label="Nivel">
        {safeUser.role === "estoquista" && safeUser.nivel_estoquista ? (
          <span className="users-level-badge">Nivel {safeUser.nivel_estoquista}</span>
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
        <span className={`users-status-badge users-status-${status}`}>
          {status === "active" ? "ATIVO" : "INATIVO"}
        </span>
      </td>

      <td data-label="Criado em">
        <span className="users-muted-text">{formatCreatedAt(safeUser)}</span>
      </td>

      <td data-label="Acoes">
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
  const safeUsers = Array.isArray(users) ? users.filter(Boolean) : [];

  return (
    <Panel
      className="users-list-card"
      title="Usuarios cadastrados"
      subtitle="Gerencie perfis, empresas de acesso e credenciais sem poluir a listagem principal."
      headerClassName="users-list-header"
    >
      <DataState
        loading={loading}
        error={error}
        empty={safeUsers.length === 0}
        loadingTitle="Carregando usuarios"
        loadingMessage="Buscando a lista de acessos cadastrados."
        errorTitle="Nao foi possivel carregar os usuarios"
        emptyTitle="Nenhum usuario cadastrado"
        emptyMessage="Quando novos gestores ou estoquistas forem criados, eles aparecerao aqui."
        panel={false}
      >
        <TableContainer className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Perfil</th>
                <th>Nivel</th>
                <th>Empresas</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Acoes</th>
              </tr>
            </thead>

            <tbody>
              {safeUsers.map((user) => (
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
