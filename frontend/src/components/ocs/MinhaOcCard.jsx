import { memo, useCallback } from "react";
import {
  formatCountProgress,
  formatOcCode,
  getOcStatusLabel
} from "../../utils/formatters";
import { isOcReadyForApproval } from "../../utils/ocData";
import OcEmpresaBadge from "./OcEmpresaBadge";

function MinhaOcCard({ oc, canFinalizeOc, finalizingId, onOpenOc, onFinalizeOc }) {
  const readyForApproval = isOcReadyForApproval(oc);
  const isFinalizing = finalizingId === oc?.id;

  const handleOpenOc = useCallback((e) => {
    e.stopPropagation();
    onOpenOc(oc?.id);
  }, [oc?.id, onOpenOc]);

  const handleFinalize = useCallback(async (e) => {
    e.stopPropagation();
    if (oc) {
      await onFinalizeOc(oc);
    }
  }, [oc, onFinalizeOc]);

  return (
    <div className="oc-card">
      <div className="oc-info">
        <span className="status-badge">{getOcStatusLabel("aberta", { uppercase: true })}</span>
        <OcEmpresaBadge oc={oc} />
        <p className="oc-codigo">OC {formatOcCode(oc?.id)}</p>
        <div className="oc-meta-row">
          <p className="oc-qtd">
            Itens contados: {formatCountProgress(oc?.qtd_contados, oc?.qtd)}
          </p>
          <p className="oc-tempo">
            {readyForApproval
              ? "Pronta para envio à aprovação"
              : "Continue a contagem para liberar a finalização"}
          </p>
        </div>
      </div>

      <div className="oc-actions">
        <button className="btn localizar" type="button" onClick={handleOpenOc} disabled={isFinalizing}>
          Localizar
        </button>

        {canFinalizeOc && (
          <button
            className="btn finalizar"
            type="button"
            disabled={isFinalizing || !readyForApproval}
            onClick={handleFinalize}
          >
            {isFinalizing ? "Finalizando..." : "Finalizar"}
          </button>
        )}

        <button className="btn pendente" type="button" disabled>
          {readyForApproval ? "Liberado" : "Pendente"}
        </button>
      </div>
    </div>
  );
}

export default memo(MinhaOcCard);
