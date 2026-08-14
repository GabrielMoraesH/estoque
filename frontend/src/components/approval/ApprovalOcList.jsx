import { memo, useCallback } from "react";
import DataState from "../ui/DataState";
import {
  formatOcCode,
  formatDateTime,
  formatQuantity,
  formatResponsibleName,
  getOcStatusLabel
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";
import OcEmpresaBadge from "../ocs/OcEmpresaBadge";

const ApprovalOcCard = memo(function ApprovalOcCard({
  oc,
  approvingId,
  openingDetailsId,
  canApprove,
  onOpenDetails,
  onApprove
}) {
  const isApproving = approvingId === oc?.id;
  const isOpeningDetails = openingDetailsId === oc?.id;
  const isBusy = isApproving || isOpeningDetails;

  const handleOpenDetails = useCallback(() => {
    if (oc) {
      onOpenDetails(oc);
    }
  }, [oc, onOpenDetails]);

  const handleApprove = useCallback(() => {
    onApprove(oc?.id);
  }, [oc?.id, onApprove]);

  return (
    <div className="oc-card">
      <div className="oc-info">
        <span className="status-badge">
          {getOcStatusLabel("aguardando_aprovacao", { uppercase: true })}
        </span>
        <OcEmpresaBadge oc={oc} />
        <p className="oc-codigo">OC {formatOcCode(oc?.id)}</p>
        <div className="oc-meta-row">
          <p className="oc-qtd">Produtos contados: {formatQuantity(oc?.qtd)}</p>
          <p className="oc-tempo">Criador: {formatResponsibleName(oc?.gestor_nome)}</p>
          <p className="oc-tempo">Responsável operacional: {formatResponsibleName(oc?.estoquista_nome)}</p>
          <p className="oc-tempo">Última movimentação: {formatDateTime(oc?.ultima_movimentacao_em || oc?.updated_at)}</p>
        </div>
      </div>

      <div className="oc-actions">
        <button
          className="btn localizar"
          type="button"
          onClick={handleOpenDetails}
          disabled={isBusy}
        >
          {isOpeningDetails ? "Abrindo..." : "Abrir detalhes"}
        </button>

        {canApprove && (
          <button
            className="btn aprovar-btn"
            type="button"
            onClick={handleApprove}
            disabled={isBusy}
          >
            {isApproving ? "Aprovando..." : "Aprovar"}
          </button>
        )}
      </div>
    </div>
  );
});

function ApprovalOcList({
  loading,
  error,
  ocs,
  approvingId,
  openingDetailsId,
  canApprove,
  onOpenDetails,
  onApprove
}) {
  const safeOcs = getRenderableList(ocs);

  return (
    <DataState
      loading={loading}
      error={error}
      empty={safeOcs.length === 0}
      loadingTitle="Carregando OCs para aprovação"
      loadingMessage="Buscando ordens finalizadas que aguardam revisão."
      errorTitle="Não foi possível carregar as aprovações"
      emptyTitle="Nenhuma OC aguardando aprovação"
      emptyMessage="Quando uma contagem for finalizada pelo estoquista, ela aparecerá aqui."
    >
      <div className="aprovacao-list">
        {safeOcs.map((oc) => (
          <ApprovalOcCard
            key={oc.id}
            oc={oc}
            approvingId={approvingId}
            openingDetailsId={openingDetailsId}
            canApprove={canApprove}
            onOpenDetails={onOpenDetails}
            onApprove={onApprove}
          />
        ))}
      </div>
    </DataState>
  );
}

export default memo(ApprovalOcList);
