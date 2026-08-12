import Layout from "../components/Layout";
import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import "../styles/app-pages.css";
import "../styles/users.css";
import { useToast } from "../components/ToastProvider";
import BackButton from "../components/BackButton";
import PageHeader from "../components/ui/PageHeader";
import UserCreateForm from "../components/users/UserCreateForm";
import UserListTable from "../components/users/UserListTable";
import UserEditModal from "../components/users/UserEditModal";
import {
  INITIAL_USER_FORM,
  areUserFormsEqual,
  getEditableUser,
  getEditableUsersById
} from "../components/users/userFormData";
import usePermissions from "../hooks/usePermissions";
import useUsers from "../hooks/useUsers";
import useAuth from "../hooks/useAuth";
import { getEmpresas } from "../services/api";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import { asArray } from "../utils/ocData";

const MIN_PASSWORD_LENGTH = 6;

function isInvalidNewPassword(senha) {
  return typeof senha !== "string" || senha.length < MIN_PASSWORD_LENGTH;
}

function isInvalidOptionalPassword(senha) {
  return typeof senha === "string" && senha.trim().length > 0 && senha.length < MIN_PASSWORD_LENGTH;
}

function Users() {
  const { canManageUsers } = usePermissions();
  const { user: loggedUser } = useAuth();
  const [form, setForm] = useState(INITIAL_USER_FORM);
  const [users, setUsers] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [editingUsers, setEditingUsers] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const { showToast } = useToast();
  const { fetchUsers, createUser, editUser, editUserStatus } = useUsers();

  const loadEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);

    try {
      const data = await getEmpresas();
      setEmpresas(asArray(data));
    } catch (error) {
      const message = getFeedbackErrorMessage(error, "Não foi possível carregar as empresas.");
      setEmpresas([]);
      showToast(message, "error");
    } finally {
      setLoadingEmpresas(false);
    }
  }, [showToast]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError("");

    try {
      const data = await fetchUsers();

      const loadedUsers = asArray(data);
      setUsers(loadedUsers);
      setEditingUsers(getEditableUsersById(loadedUsers));
    } catch (error) {
      const message = getFeedbackErrorMessage(error, feedbackMessages.users.loadError);
      setUsers([]);
      setUsersError(message);
      showToast(message, "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [fetchUsers, showToast]);

  useEffect(() => {
    if (canManageUsers) {
      loadUsers();
      loadEmpresas();
    }
  }, [canManageUsers, loadEmpresas, loadUsers]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (creating) {
      return;
    }

    if (!Array.isArray(form.empresa_ids) || form.empresa_ids.length === 0) {
      showToast("Selecione ao menos uma empresa de acesso.", "error");
      return;
    }

    if (isInvalidNewPassword(form.senha)) {
      showToast("A senha deve possuir no mínimo 6 caracteres.", "error");
      return;
    }

    setCreating(true);

    try {
      const res = await createUser(form);

      if (res?.id) {
        showToast(feedbackMessages.users.createSuccess);
        const createdUser = {
          id: res.id,
          nome: res.nome || form.nome,
          login: res.login || form.login,
          role: res.role || form.role,
          nivel_estoquista: res.nivel_estoquista ?? form.nivel_estoquista ?? null,
          ativo: res.ativo !== false,
          created_at: res.created_at || null,
          empresas: asArray(res.empresas)
        };

        setUsers((current) => [...current, createdUser]);
        setEditingUsers((current) => ({
          ...current,
          [createdUser.id]: getEditableUser(createdUser)
        }));
        setForm(INITIAL_USER_FORM);
        return;
      }

      showToast(feedbackMessages.users.createError, "error");
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.users.createError), "error");
    } finally {
      setCreating(false);
    }
  }, [createUser, creating, form, showToast]);

  const handleCreateFormChange = useCallback((field, value) => {
    setForm((current) => {
      if (field === "role") {
        return {
          ...current,
          role: value,
          nivel_estoquista: value === "estoquista" ? (current.nivel_estoquista || 1) : null
        };
      }

      return { ...current, [field]: value };
    });
  }, []);

  const handleEditChange = useCallback((id, field, value) => {
    if (!id) {
      return;
    }

    setEditingUsers((current) => {
      const currentUser = current[id] || getEditableUser();

      if (field === "role") {
        return {
          ...current,
          [id]: {
            ...currentUser,
            role: value,
            nivel_estoquista: value === "estoquista" ? (currentUser.nivel_estoquista || 1) : null
          }
        };
      }

      return {
        ...current,
        [id]: {
          ...currentUser,
          [field]: value
        }
      };
    });
  }, []);

  const handleSaveUser = useCallback(async (id) => {
    if (!id || savingId === id) {
      return;
    }

    const payload = editingUsers[id] || getEditableUser();
    const originalUser = asArray(users).find((user) => user?.id === id);

    if (Array.isArray(payload.empresa_ids) && payload.empresa_ids.length === 0) {
      showToast("Selecione ao menos uma empresa de acesso.", "error");
      return;
    }

    if (isInvalidOptionalPassword(payload.senha)) {
      showToast("A nova senha deve possuir no mínimo 6 caracteres.", "error");
      return;
    }

    if (originalUser && areUserFormsEqual(payload, getEditableUser(originalUser))) {
      showToast("Nenhuma alteração pendente para salvar.", "info");
      return;
    }

    setSavingId(id);

    try {
      const res = await editUser(id, payload);

      if (res?.id) {
        showToast(feedbackMessages.users.updateSuccess);
        const updatedUser = {
          id: res.id || id,
          nome: res.nome || editingUsers[id]?.nome || "",
          login: res.login || editingUsers[id]?.login || "",
          role: res.role || editingUsers[id]?.role || "gestor",
          nivel_estoquista: res.nivel_estoquista ?? editingUsers[id]?.nivel_estoquista ?? null,
          ativo: res.ativo !== false,
          created_at: res.created_at || originalUser?.created_at || null,
          empresas: asArray(res.empresas)
        };

        setUsers((current) =>
          asArray(current).map((user) => (user?.id === id ? { ...user, ...updatedUser } : user))
        );
        setEditingUsers((current) => ({
          ...current,
          [id]: getEditableUser(updatedUser)
        }));
        setUserToEdit(null);
        return;
      }

      showToast(feedbackMessages.users.updateError, "error");
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.users.updateError), "error");
    } finally {
      setSavingId(null);
    }
  }, [editUser, editingUsers, savingId, showToast, users]);

  const handleRequestEdit = useCallback((user) => {
    if (!user?.id) {
      return;
    }

    setEditingUsers((current) => ({
      ...current,
      [user.id]: getEditableUser(user)
    }));
    setUserToEdit(user);
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (savingId) {
      return;
    }

    if (userToEdit?.id) {
      setEditingUsers((current) => ({
        ...current,
        [userToEdit.id]: getEditableUser(userToEdit)
      }));
    }

    setUserToEdit(null);
  }, [savingId, userToEdit]);

  const handleRequestStatusChange = useCallback((user) => {
    if (!user?.id) {
      return;
    }

    setStatusTarget(user);
  }, []);

  const handleCancelStatusChange = useCallback(() => {
    if (statusSavingId) {
      return;
    }

    setStatusTarget(null);
  }, [statusSavingId]);

  const handleConfirmStatusChange = useCallback(async () => {
    if (!statusTarget?.id || statusSavingId === statusTarget.id) {
      return;
    }

    const nextAtivo = statusTarget.ativo === false;

    if (!nextAtivo && Number(statusTarget.id) === Number(loggedUser?.id)) {
      showToast("Voce nao pode desativar seu proprio usuario.", "error");
      setStatusTarget(null);
      return;
    }

    setStatusSavingId(statusTarget.id);

    try {
      const res = await editUserStatus(statusTarget.id, { ativo: nextAtivo });

      if (res?.id) {
        const updatedUser = {
          ...statusTarget,
          ...res,
          ativo: res.ativo !== false,
          empresas: asArray(res.empresas)
        };

        setUsers((current) =>
          asArray(current).map((user) => (user?.id === statusTarget.id ? { ...user, ...updatedUser } : user))
        );
        setEditingUsers((current) => ({
          ...current,
          [statusTarget.id]: getEditableUser(updatedUser)
        }));
        showToast(nextAtivo ? "Usuario reativado com sucesso." : "Usuario desativado com sucesso.");
        setStatusTarget(null);
        return;
      }

      showToast("Nao foi possivel atualizar o status do usuario.", "error");
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, "Nao foi possivel atualizar o status do usuario."), "error");
    } finally {
      setStatusSavingId(null);
    }
  }, [editUserStatus, loggedUser?.id, showToast, statusSavingId, statusTarget]);

  if (!canManageUsers) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell users-page">
        <BackButton to="/dashboard" />

        <PageHeader
          title="Usuários"
          subtitle="Cadastre novos usuários e mantenha os acessos do sistema atualizados."
        />

        <UserCreateForm
          form={form}
          empresas={empresas}
          empresasLoading={loadingEmpresas}
          creating={creating}
          onSubmit={handleSubmit}
          onChange={handleCreateFormChange}
        />

        <UserListTable
          loading={loadingUsers}
          error={usersError}
          users={users}
          statusSavingId={statusSavingId}
          onRequestEdit={handleRequestEdit}
          onRequestStatusChange={handleRequestStatusChange}
        />
      </div>

      <UserEditModal
        user={userToEdit}
        editingUser={userToEdit?.id ? editingUsers[userToEdit.id] : null}
        empresas={empresas}
        savingId={savingId}
        onChange={handleEditChange}
        onSave={handleSaveUser}
        onCancel={handleCancelEdit}
      />

      <UserStatusModal
        user={statusTarget}
        savingId={statusSavingId}
        onCancel={handleCancelStatusChange}
        onConfirm={handleConfirmStatusChange}
      />

    </Layout>
  );
}

function UserStatusModal({ user, savingId, onCancel, onConfirm }) {
  const isSaving = savingId === user?.id;

  if (!user) {
    return null;
  }

  const isActive = user.ativo !== false;
  const actionLabel = isActive ? "desativar" : "reativar";

  return (
    <div className="users-modal-overlay" onClick={isSaving ? undefined : onCancel}>
      <div
        className="users-modal users-status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-status-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="users-modal-kicker">Status do usuario</p>
        <h3 id="user-status-modal-title" className="users-modal-title">
          {isActive ? "Desativar usuario" : "Reativar usuario"}
        </h3>
        <p className="users-modal-text">
          {isActive ? "Deseja desativar este usuário?" : "Deseja reativar este usuário?"}
        </p>
        <p className="users-modal-user">{user.nome || user.login}</p>

        <div className="users-modal-actions">
          <button
            className="users-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </button>

          <button
            className={`users-status-confirm users-status-confirm-${isActive ? "danger" : "success"}`}
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Users;
