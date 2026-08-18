import { memo, useCallback } from "react";
import { formatCountProgress, formatOcCode, formatResponsibleName } from "../../utils/formatters";
import { isOcReadyForApproval } from "../../utils/ocData";
import OcEmpresaBadge from "./OcEmpresaBadge";

function MinhaOcCard({ oc, responsibleName, canFinalizeOc, finalizingId, onOpenOc, onFinalizeOc }) {
  const readyToFinalize = isOcReadyForApproval(oc);
  const isFinalizing = finalizingId === oc?.id;
  const handleOpenOc = useCallback((event) => {
    event.stopPropagation();
    onOpenOc(oc?.id);
  }, [oc?.id, onOpenOc]);
  const handleFinalize = useCallback(async (event) => {
    event.stopPropagation();
    if (oc) await onFinalizeOc(oc);
  }, [oc, onFinalizeOc]);

  return (
    <article className="oc-card" aria-label={`OC ${formatOcCode(oc?.id)}`}>
      <div className="oc-info">
        <span className="status-badge">{readyToFinalize ? "PRONTA PARA FINALIZAR" : "EM ANDAMENTO"}</span>
        <OcEmpresaBadge oc={oc} />
        <p className="oc-codigo">OC {formatOcCode(oc?.id)}</p>
        <p className="oc-responsavel">Responsável: {formatResponsibleName(oc?.estoquista_nome || responsibleName)}</p>
        <div className="oc-meta-row">
          <p className="oc-qtd">{formatCountProgress(oc?.qtd_contados, oc?.qtd)} localizações contadas</p>
          <p className="oc-tempo">{readyToFinalize ? "Todas as localizações foram contadas" : "Há localizações pendentes"}</p>
        </div>
      </div>
      <div className="oc-actions">
        <button className="btn localizar" type="button" onClick={handleOpenOc} disabled={isFinalizing}>Abrir OC</button>
        {canFinalizeOc && (
          <button className="btn finalizar" type="button" disabled={isFinalizing || !readyToFinalize} onClick={handleFinalize}>
            {isFinalizing ? "Finalizando..." : "Finalizar contagem"}
          </button>
        )}
      </div>
    </article>
  );
}

export default memo(MinhaOcCard);
