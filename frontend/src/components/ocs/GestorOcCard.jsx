import { memo, useCallback } from "react";
import {
  formatDateTime,
  formatOcCode,
  formatQuantity,
  formatRelativeTime,
  formatResponsibleName
} from "../../utils/formatters";
import { getOperationalOcStatus, getOperationalOcStatusLabel } from "../../utils/ocData";
import OcEmpresaBadge from "./OcEmpresaBadge";
import Button from "../ui/Button";
import StatusPill, { getStatusPillVariant } from "../ui/StatusPill";

function GestorOcCard({ oc, onOpenOc }) {
  const safeOc = oc || {};

  const handleOpenOc = useCallback(() => {
    onOpenOc(safeOc.id);
  }, [safeOc.id, onOpenOc]);
  const status = getOperationalOcStatus(safeOc);
  const statusVariant = getStatusPillVariant(status);

  return (
    <div className="oc-card gestor-oc-card">
      <div className="oc-info gestor-oc-info">
        <StatusPill variant={statusVariant}>{getOperationalOcStatusLabel(safeOc)}</StatusPill>
        <OcEmpresaBadge oc={safeOc} />

        <div className="gestor-oc-headline">
          <p className="oc-codigo">OC {formatOcCode(safeOc.id)}</p>
          <div className="oc-meta-row">
            <p className="oc-qtd">Produtos: {formatQuantity(safeOc.qtd)}</p>
          </div>
        </div>

        <div className="gestor-oc-meta-grid">
          <div className="gestor-oc-meta">
            <span>Criado por</span>
            <strong>{formatResponsibleName(safeOc.criador_nome, "-")}</strong>
          </div>

          <div className="gestor-oc-meta">
            <span>Responsável operacional</span>
            <strong>{formatResponsibleName(safeOc.estoquista_nome)}</strong>
          </div>

          <div className="gestor-oc-meta">
            <span>Progresso</span>
            <strong>{safeOc.status === "finalizada" ? "Concluída" : `${formatQuantity(safeOc.localizacoes_contadas)} / ${formatQuantity(safeOc.total_localizacoes)} localizações`}</strong>
          </div>

          <div className="gestor-oc-meta">
            <span>Criada em</span>
            <strong>{formatDateTime(safeOc.created_at)}</strong>
          </div>

          <div className="gestor-oc-meta">
            <span>Última movimentação</span>
            <strong>{formatRelativeTime(safeOc.ultima_movimentacao_em || safeOc.updated_at || safeOc.created_at)}</strong>
          </div>
        </div>
      </div>

      <div className="oc-actions gestor-oc-actions">
        <Button variant="secondary" onClick={handleOpenOc}>
          Abrir detalhes
        </Button>
      </div>
    </div>
  );
}

export default memo(GestorOcCard);
