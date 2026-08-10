import { memo, useCallback, useEffect } from "react";
import { feedbackMessages } from "../../utils/feedbackMessages";

function DeleteUserModal({ user, deletingId, onCancel, onConfirm }) {
  const isDeleting = deletingId === user?.id;

  const handleModalClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="users-modal-overlay" onClick={isDeleting ? undefined : onCancel}>
      <div
        className="users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-modal-title"
        onClick={handleModalClick}
      >
        <h3 id="delete-user-modal-title" className="users-modal-title">{feedbackMessages.users.deleteTitle}</h3>
        <p className="users-modal-text">
          {feedbackMessages.users.deleteQuestionPrefix} <strong>{user.nome}</strong>?
        </p>
        <p className="users-modal-warning">
          {feedbackMessages.users.deleteWarning}
        </p>

        <div className="users-modal-actions">
          <button
            className="users-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancelar
          </button>

          <button
            className="users-delete-button"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting
              ? feedbackMessages.users.deletingButton
              : feedbackMessages.users.deleteButton}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(DeleteUserModal);
