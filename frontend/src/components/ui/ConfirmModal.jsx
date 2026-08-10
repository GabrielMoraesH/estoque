import { memo, useCallback, useEffect, useId } from "react";
import "../../styles/confirm-modal.css";

const VARIANT_CLASS_NAMES = {
  danger: "confirm-modal-confirm-danger",
  primary: "confirm-modal-confirm-primary",
  success: "confirm-modal-confirm-success",
  warning: "confirm-modal-confirm-warning"
};

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "warning",
  onConfirm,
  onCancel,
  loading = false
}) {
  const titleId = useId();
  const messageId = useId();
  const confirmClassName = VARIANT_CLASS_NAMES[variant] || VARIANT_CLASS_NAMES.warning;

  const handleOverlayClick = useCallback(() => {
    if (!loading) {
      onCancel?.();
    }
  }, [loading, onCancel]);

  const handleModalClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleConfirm = useCallback(() => {
    if (!loading) {
      onConfirm?.();
    }
  }, [loading, onConfirm]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) {
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="confirm-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onClick={handleModalClick}
      >
        <h3 id={titleId} className="confirm-modal-title">{title}</h3>
        {message && (
          <p id={messageId} className="confirm-modal-message">{message}</p>
        )}

        <div className="confirm-modal-actions">
          <button
            className="confirm-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>

          <button
            className={`confirm-modal-confirm ${confirmClassName}`}
            type="button"
            onClick={handleConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ConfirmModal);
