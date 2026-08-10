import { memo, useCallback } from "react";
import {
  formatDateTime,
  formatOcCode,
  formatQuantity,
  formatRelativeTime,
  formatResponsibleName,
  getOcResponsibleLabel,
  getOcStatusLabel,
  getStatusClassName
} from "../../utils/formatters";
import OcEmpresaBadge from "./OcEmpresaBadge";

function GestorOcCard({ oc, onOpenOc }) {
  const safeOc = oc || {};

  const handleOpenOc = useCallback(() => {
    onOpenOc(safeOc.id);
  }, [safeOc.id, onOpenOc]);

  return (
    <div className="oc-card gestor-oc-card">
      <div className="oc-info gestor-oc-info">
        <span className={`status-badge ${getStatusClassName(safeOc.status)}`}>
          {getOcStatusLabel(safeOc.status, { uppercase: true })}
        </span>
        <OcEmpresaBadge oc={safeOc} />

        <div className="gestor-oc-headline">
          <p className="oc-codigo">OC {formatOcCode(safeOc.id)}</p>
          <div className="oc-meta-row">
            <p className="oc-qtd">Itens na ordem: {formatQuantity(safeOc.qtd)}</p>
          </div>
        </div>

        <div className="gestor-oc-meta-grid">
          <div className="gestor-oc-meta">
            <span>{getOcResponsibleLabel(safeOc.status)}</span>
            <strong>{formatResponsibleName(safeOc.estoquista_nome)}</strong>
          </div>

          <div className="gestor-oc-meta">
            <span>Criada em</span>
            <strong>{formatDateTime(safeOc.created_at)}</strong>
          </div>

          <div className="gestor-oc-meta">
            <span>Última movimentação</span>
            <strong>{formatRelativeTime(safeOc.ultima_contagem_em)}</strong>
          </div>
        </div>
      </div>

      <div className="oc-actions gestor-oc-actions">
        <button className="btn localizar" type="button" onClick={handleOpenOc}>
          Abrir detalhes
        </button>
      </div>
    </div>
  );
}

export default memo(GestorOcCard);
