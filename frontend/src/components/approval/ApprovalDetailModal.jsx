import { useEffect } from "react";
import CountingTrace from "../CountingTrace";

function ApprovalDetailModal({ detailModal, onClose }) {
  useEffect(() => {
    if (!detailModal) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailModal, onClose]);

  if (!detailModal) {
    return null;
  }

  const rows = Array.isArray(detailModal.rows) ? detailModal.rows : [];

  return (
    <div className="aprovacao-modal-overlay" onClick={onClose}>
      <div
        className="aprovacao-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-detail-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aprovacao-modal-header">
          <h3 id="approval-detail-modal-title">{detailModal.title || "Detalhes"}</h3>
          <button
            className="aprovacao-close-button"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="aprovacao-modal-list">
          {rows.map((row, index) => (
            <div key={`${row?.principal || "detail"}-${index}`} className="aprovacao-modal-item">
              <strong>{row?.principal || "Não informado"}</strong>
              <span>{row?.secondary || ""}</span>
              {row?.countingTrace?.hasCount && (
                <CountingTrace trace={row.countingTrace} compact />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ApprovalDetailModal;
