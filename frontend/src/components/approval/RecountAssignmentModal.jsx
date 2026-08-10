import { memo, useCallback, useEffect, useId } from "react";
import OcEmpresaBadge from "../ocs/OcEmpresaBadge";

function getEstoquistaLabel(estoquista) {
  const level = Number(estoquista?.nivel_estoquista);
  const levelLabel = [1, 2, 3].includes(level) ? ` - nível ${level}` : "";
  return `${estoquista?.nome || "Estoquista"}${levelLabel}`;
}

function hasEmpresaAccess(estoquista, empresaId) {
  const empresas = Array.isArray(estoquista?.empresas) ? estoquista.empresas : [];

  if (!empresaId || empresas.length === 0) {
    return true;
  }

  return empresas.some((empresa) => Number(empresa?.id ?? empresa) === Number(empresaId));
}

function RecountAssignmentModal({
  open,
  estoquistas,
  selectedEstoquistaId,
  currentEstoquistaId,
  oc,
  loadingEstoquistas,
  confirming,
  onChangeEstoquista,
  onCancel,
  onConfirm
}) {
  const titleId = useId();
  const messageId = useId();
  const safeEstoquistas = Array.isArray(estoquistas) ? estoquistas.filter(Boolean) : [];
  const availableEstoquistas = safeEstoquistas.filter(
    (estoquista) =>
      Number(estoquista?.id) !== Number(currentEstoquistaId) &&
      estoquista?.ativo !== false &&
      Number(estoquista?.nivel_estoquista) === 2 &&
      hasEmpresaAccess(estoquista, oc?.empresa_id)
  );
  const isBusy = loadingEstoquistas || confirming;

  const handleOverlayClick = useCallback(() => {
    if (!isBusy) {
      onCancel?.();
    }
  }, [isBusy, onCancel]);

  const handleModalClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleChange = useCallback((event) => {
    onChangeEstoquista?.(event.target.value ? Number(event.target.value) : "");
  }, [onChangeEstoquista]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isBusy) {
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="aprovacao-recount-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="aprovacao-recount-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={handleModalClick}
      >
        <h3 id={titleId} className="aprovacao-recount-modal-title">Enviar para recontagem</h3>
        <p id={messageId} className="aprovacao-recount-modal-message">
          Selecione o estoquista responsável pela recontagem.
        </p>

        <div className="aprovacao-recount-modal-company">
          <span>Empresa da OC</span>
          <OcEmpresaBadge oc={oc} />
        </div>

        <label className="aprovacao-recount-modal-field" htmlFor="novo_estoquista_id">
          <span>Estoquista</span>
          <select
            id="novo_estoquista_id"
            value={selectedEstoquistaId || ""}
            onChange={handleChange}
            disabled={isBusy || availableEstoquistas.length === 0}
          >
            <option value="">
              {loadingEstoquistas ? "Carregando estoquistas..." : "Selecione um estoquista"}
            </option>
            {availableEstoquistas.map((estoquista) => (
              <option key={estoquista.id} value={estoquista.id}>
                {getEstoquistaLabel(estoquista)}
              </option>
            ))}
          </select>
        </label>

        {availableEstoquistas.length === 0 && !loadingEstoquistas && (
          <p className="aprovacao-recount-modal-error">
            Nenhum outro estoquista disponível para esta recontagem.
          </p>
        )}

        <div className="aprovacao-recount-modal-actions">
          <button
            className="aprovacao-recount-modal-cancel"
            type="button"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancelar
          </button>
          <button
            className="aprovacao-recount-modal-confirm"
            type="button"
            onClick={onConfirm}
            disabled={isBusy || availableEstoquistas.length === 0}
          >
            {confirming ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(RecountAssignmentModal);
