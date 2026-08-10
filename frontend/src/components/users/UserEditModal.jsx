import { memo, useCallback, useEffect, useMemo } from "react";
import { areUserFormsEqual, getEditableUser } from "./userFormData";

const ROLE_LABELS = {
  admin: "Admin",
  gestor: "Gestor",
  estoquista: "Estoquista"
};

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function UserEditModal({
  user,
  editingUser,
  empresas = [],
  savingId,
  onChange,
  onSave,
  onCancel
}) {
  const safeUser = user || null;
  const userId = safeUser?.id;
  const safeEditingUser = editingUser || getEditableUser(safeUser);
  const selectedEmpresaIds = useMemo(
    () => (Array.isArray(safeEditingUser?.empresa_ids) ? safeEditingUser.empresa_ids : []),
    [safeEditingUser?.empresa_ids]
  );
  const isSaving = savingId === safeUser?.id;
  const hasPendingChanges = !areUserFormsEqual(safeEditingUser, getEditableUser(safeUser));
  const showLevelSelect = safeEditingUser?.role === "estoquista";
  const status = typeof safeUser?.ativo === "boolean"
    ? safeUser.ativo
    : typeof safeUser?.active === "boolean"
      ? safeUser.active
      : true;
  const supportsStatusControl = typeof safeUser?.ativo === "boolean" || typeof safeUser?.active === "boolean";

  const handleModalClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleFieldChange = useCallback((field) => (event) => {
    onChange(userId, field, event.target.value);
  }, [onChange, userId]);

  const handleNivelChange = useCallback((event) => {
    onChange(userId, "nivel_estoquista", Number(event.target.value));
  }, [onChange, userId]);

  const handleEmpresaToggle = useCallback((empresaId) => {
    const isSelected = selectedEmpresaIds.includes(empresaId);
    const nextEmpresaIds = isSelected
      ? selectedEmpresaIds.filter((selectedId) => selectedId !== empresaId)
      : [...selectedEmpresaIds, empresaId];

    onChange(userId, "empresa_ids", nextEmpresaIds);
  }, [onChange, userId, selectedEmpresaIds]);

  const handleSave = useCallback(() => {
    onSave(userId);
  }, [onSave, userId]);

  useEffect(() => {
    if (!safeUser) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSaving) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onCancel, safeUser]);

  if (!safeUser) {
    return null;
  }

  return (
    <div className="users-modal-overlay" onClick={isSaving ? undefined : onCancel}>
      <div
        className="users-modal users-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-modal-title"
        onClick={handleModalClick}
      >
        <div className="users-modal-header">
          <div>
            <p className="users-modal-kicker">Editar usuario</p>
            <h3 id="edit-user-modal-title" className="users-modal-title">
              {safeUser.nome || "Usuario"}
            </h3>
          </div>

          <button
            className="users-modal-close"
            type="button"
            aria-label="Fechar modal"
            title="Fechar"
            disabled={isSaving}
            onClick={onCancel}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="users-edit-form">
          <div className="users-field">
            <label htmlFor="edit-nome">Nome</label>
            <input
              id="edit-nome"
              value={safeEditingUser.nome || ""}
              onChange={handleFieldChange("nome")}
              disabled={isSaving}
            />
          </div>

          <div className="users-field">
            <label htmlFor="edit-login">Login</label>
            <input
              id="edit-login"
              value={safeEditingUser.login || ""}
              onChange={handleFieldChange("login")}
              disabled={isSaving}
            />
          </div>

          <div className="users-field">
            <label htmlFor="edit-senha">Nova senha</label>
            <input
              id="edit-senha"
              type="password"
              value={safeEditingUser.senha || ""}
              placeholder="Opcional"
              onChange={handleFieldChange("senha")}
              disabled={isSaving}
            />
          </div>

          <div className={`users-role-level-row${showLevelSelect ? " has-level" : ""}`}>
            <div className="users-field">
              <label htmlFor="edit-role">Perfil</label>
              <select
                id="edit-role"
                value={safeEditingUser.role || "gestor"}
                onChange={handleFieldChange("role")}
                disabled={isSaving}
              >
                <option value="gestor">{ROLE_LABELS.gestor}</option>
                <option value="estoquista">{ROLE_LABELS.estoquista}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </select>
            </div>

            {showLevelSelect && (
              <div className="users-field">
                <label htmlFor="edit-nivel">Nivel do estoquista</label>
                <select
                  id="edit-nivel"
                  value={safeEditingUser.nivel_estoquista || 1}
                  onChange={handleNivelChange}
                  disabled={isSaving}
                >
                  <option value={1}>Nivel 1</option>
                  <option value={2}>Nivel 2</option>
                  <option value={3}>Nivel 3</option>
                </select>
              </div>
            )}
          </div>

          {supportsStatusControl && (
            <div className="users-field">
              <span className="users-field-label">Status</span>
              <div className="users-status-control" aria-label="Status do usuario">
                <span className={`users-status-choice${status ? " is-selected" : ""}`}>
                  Ativo
                </span>
                <span className={`users-status-choice${!status ? " is-selected" : ""}`}>
                  Inativo
                </span>
              </div>
            </div>
          )}

          <fieldset className="users-field users-companies-field users-modal-companies-field">
            <legend>Empresas</legend>

            <div className="users-company-options users-company-badge-grid">
              {empresas.length === 0 ? (
                <span className="users-company-empty">Nenhuma empresa ativa encontrada.</span>
              ) : (
                empresas.map((empresa) => {
                  const empresaId = Number(empresa.id);
                  const isSelected = selectedEmpresaIds.includes(empresaId);

                  return (
                    <button
                      className={`users-company-select${isSelected ? " is-selected" : ""}`}
                      type="button"
                      key={empresa.id}
                      onClick={() => handleEmpresaToggle(empresaId)}
                      disabled={isSaving}
                    >
                      <span aria-hidden="true">{isSelected ? "\u2713" : ""}</span>
                      {empresa.nome}
                    </button>
                  );
                })
              )}
            </div>
          </fieldset>
        </div>

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
            className="users-save-button"
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasPendingChanges}
          >
            {isSaving ? "Salvando..." : "Salvar alteracoes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(UserEditModal);
