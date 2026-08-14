import { memo, useCallback } from "react";
import DataState from "../ui/DataState";
import CountingTrace from "../CountingTrace";
import Panel from "../ui/Panel";
import TableContainer from "../ui/TableContainer";
import OcEmpresaBadge from "../ocs/OcEmpresaBadge";
import {
  formatBalance,
  formatOcCode,
  formatProductName,
  formatResponsibleName,
  formatSignedNumber,
  getItemStatusLabel
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";

const ApprovalDetailsRow = memo(function ApprovalDetailsRow({
  item,
  canRequestRecount,
  interactionDisabled,
  isMarkedForRecount,
  onToggleRecountGroup,
  onOpenLocationDetails,
  onOpenLotDetails,
  onOpenHistoryDetails
}) {
  const handleOpenLocationDetails = useCallback(() => {
    if (item) {
      onOpenLocationDetails(item);
    }
  }, [item, onOpenLocationDetails]);

  const handleOpenLotDetails = useCallback(() => {
    if (item) {
      onOpenLotDetails(item);
    }
  }, [item, onOpenLotDetails]);

  const handleToggleRecountGroup = useCallback(() => {
    const itemIds = Array.isArray(item?.itemIds) ? item.itemIds : [];
    onToggleRecountGroup(itemIds);
  }, [item?.itemIds, onToggleRecountGroup]);

  const handleOpenHistoryDetails = useCallback(() => {
    if (item) onOpenHistoryDetails(item);
  }, [item, onOpenHistoryDetails]);

  const hasDifference = Number(item?.diferencaTotal) !== 0;

  return (
    <tr>
      <td className="aprovacao-product-name">
        {item?.codigo && <small>Código {item.codigo}</small>}
        {formatProductName(item)}
      </td>
      <td>{formatBalance(item?.saldoSistemaTotal)}</td>
      <td>{formatBalance(item?.saldoContadoTotal)}</td>
      <td className={`aprovacao-difference ${hasDifference ? "has-difference" : "no-difference"}`}>
        {formatSignedNumber(item?.diferencaTotal)} — {hasDifference ? "Com divergência" : "Sem divergência"}
      </td>
      <td>
        <button
          className="aprovacao-detail-button"
          type="button"
          onClick={handleOpenLocationDetails}
          disabled={interactionDisabled}
        >
          Ver localizações
        </button>
      </td>
      <td>
        <button
          className="aprovacao-detail-button"
          type="button"
          onClick={handleOpenLotDetails}
          disabled={interactionDisabled}
        >
          Ver lotes
        </button>
      </td>
      <td>
        <span className="aprovacao-item-status">{getItemStatusLabel(item?.status)}</span>
      </td>
      <td>
        <CountingTrace trace={item?.countingTrace} compact />
        <button className="aprovacao-history-button" type="button" onClick={handleOpenHistoryDetails} disabled={interactionDisabled}>
          Ver histórico completo
        </button>
      </td>
      {canRequestRecount && (
        <td>
          <input
            className="aprovacao-checkbox"
            type="checkbox"
            checked={isMarkedForRecount}
            onChange={handleToggleRecountGroup}
            disabled={interactionDisabled}
            aria-label={`Selecionar ${formatProductName(item)} para recontagem`}
          />
        </td>
      )}
    </tr>
  );
});

const ApprovalDetailsMobileCard = memo(function ApprovalDetailsMobileCard({
  item,
  canRequestRecount,
  interactionDisabled,
  isMarkedForRecount,
  onToggleRecountGroup,
  onOpenLocationDetails,
  onOpenLotDetails,
  onOpenHistoryDetails
}) {
  const handleOpenLocationDetails = useCallback(() => {
    if (item) {
      onOpenLocationDetails(item);
    }
  }, [item, onOpenLocationDetails]);

  const handleOpenLotDetails = useCallback(() => {
    if (item) {
      onOpenLotDetails(item);
    }
  }, [item, onOpenLotDetails]);

  const handleToggleRecountGroup = useCallback(() => {
    const itemIds = Array.isArray(item?.itemIds) ? item.itemIds : [];
    onToggleRecountGroup(itemIds);
  }, [item?.itemIds, onToggleRecountGroup]);

  const handleOpenHistoryDetails = useCallback(() => {
    if (item) onOpenHistoryDetails(item);
  }, [item, onOpenHistoryDetails]);

  const hasDifference = Number(item?.diferencaTotal) !== 0;

  return (
    <article className="aprovacao-mobile-card">
      <div className="aprovacao-mobile-card-header">
        <strong>{item?.codigo ? `${item.codigo} — ` : ""}{formatProductName(item)}</strong>
        <span className="aprovacao-item-status">{getItemStatusLabel(item?.status)}</span>
      </div>

      <div className="aprovacao-mobile-metrics">
        <div className="aprovacao-mobile-metric">
          <span>Saldo do sistema</span>
          <strong>{formatBalance(item?.saldoSistemaTotal)}</strong>
        </div>
        <div className="aprovacao-mobile-metric">
          <span>Saldo contado</span>
          <strong>{formatBalance(item?.saldoContadoTotal)}</strong>
        </div>
        <div className="aprovacao-mobile-metric">
          <span>Diferença</span>
          <strong className={`aprovacao-difference ${hasDifference ? "has-difference" : "no-difference"}`}>
            {formatSignedNumber(item?.diferencaTotal)} — {hasDifference ? "Com divergência" : "Sem divergência"}
          </strong>
        </div>
      </div>

      <CountingTrace trace={item?.countingTrace} compact />

      <div className="aprovacao-mobile-actions">
        <button
          className="aprovacao-detail-button"
          type="button"
          onClick={handleOpenLocationDetails}
          disabled={interactionDisabled}
        >
          Ver localizações
        </button>

        <button
          className="aprovacao-detail-button"
          type="button"
          onClick={handleOpenLotDetails}
          disabled={interactionDisabled}
        >
          Ver lotes
        </button>
        <button className="aprovacao-detail-button" type="button" onClick={handleOpenHistoryDetails} disabled={interactionDisabled}>
          Ver histórico completo
        </button>
      </div>

      {canRequestRecount && (
        <label className="aprovacao-mobile-checkbox">
          <input
            className="aprovacao-checkbox"
            type="checkbox"
            checked={isMarkedForRecount}
            onChange={handleToggleRecountGroup}
            disabled={interactionDisabled}
            aria-label={`Selecionar ${formatProductName(item)} para recontagem`}
          />
          <span>Marcar grupo para recontagem</span>
        </label>
      )}
    </article>
  );
});

function ApprovalDetailsPanel({
  selectedOC,
  groupedItems,
  loading,
  error,
  recounting,
  approvingId,
  openingDetailsId,
  canRequestRecount,
  isGroupMarkedForRecount,
  onToggleRecountGroup,
  onOpenLocationDetails,
  onOpenLotDetails,
  onOpenHistoryDetails,
  onClose,
  onSendToRecount
}) {
  if (!selectedOC) {
    return null;
  }

  const safeGroupedItems = getRenderableList(groupedItems);
  const interactionDisabled = recounting || approvingId === selectedOC?.id || openingDetailsId === selectedOC?.id;

  return (
    <Panel
      className="aprovacao-details"
      title={`Detalhes da OC ${formatOcCode(selectedOC?.id)}`}
      subtitle={`Responsável operacional: ${formatResponsibleName(selectedOC?.estoquista_nome)}`}
      headerClassName="aprovacao-details-header"
      actions={(
        <button
          className="secondary-button"
          type="button"
          onClick={onClose}
          disabled={interactionDisabled}
        >
          Fechar
        </button>
      )}
    >
      <div className="aprovacao-details-meta">
        <div>
          <span>Empresa</span>
          <OcEmpresaBadge oc={selectedOC} />
        </div>
        <div>
          <span>OC</span>
          <strong>{formatOcCode(selectedOC?.id)}</strong>
        </div>
        <div>
          <span>Criador</span>
          <strong>{formatResponsibleName(selectedOC?.gestor_nome)}</strong>
        </div>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={safeGroupedItems.length === 0}
        loadingTitle="Carregando itens da OC"
        loadingMessage="Preparando os saldos e diferenças para revisão."
        errorTitle="Não foi possível carregar os itens"
        emptyTitle="Nenhum item disponível para revisão"
        emptyMessage="Os itens contados ou aprovados aparecerão neste painel."
        panel={false}
      >
        <>
          <TableContainer className="aprovacao-table-wrapper desktop-only">
            <table className="aprovacao-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Saldo do sistema</th>
                  <th>Saldo contado</th>
                  <th>Diferença</th>
                  <th>Localizações</th>
                  <th>Lotes</th>
                  <th>Status</th>
                  <th>Contagens</th>
                  {canRequestRecount && <th>Recontar</th>}
                </tr>
              </thead>
              <tbody>
                {safeGroupedItems.map((item) => (
                  <ApprovalDetailsRow
                    key={item?.produto || item?.itemIds?.join("-")}
                    item={item}
                    canRequestRecount={canRequestRecount}
                    interactionDisabled={interactionDisabled}
                    isMarkedForRecount={isGroupMarkedForRecount(item?.itemIds || [])}
                    onToggleRecountGroup={onToggleRecountGroup}
                    onOpenLocationDetails={onOpenLocationDetails}
                    onOpenLotDetails={onOpenLotDetails}
                    onOpenHistoryDetails={onOpenHistoryDetails}
                  />
                ))}
              </tbody>
            </table>
          </TableContainer>

          <div className="aprovacao-mobile-list mobile-only">
            {safeGroupedItems.map((item) => (
              <ApprovalDetailsMobileCard
                key={item?.produto || item?.itemIds?.join("-")}
                item={item}
                canRequestRecount={canRequestRecount}
                interactionDisabled={interactionDisabled}
                isMarkedForRecount={isGroupMarkedForRecount(item?.itemIds || [])}
                onToggleRecountGroup={onToggleRecountGroup}
                onOpenLocationDetails={onOpenLocationDetails}
                onOpenLotDetails={onOpenLotDetails}
                onOpenHistoryDetails={onOpenHistoryDetails}
              />
            ))}
          </div>

          {canRequestRecount && (
            <div className="aprovacao-recount-actions">
              <button
                className="aprovacao-recount-button"
                type="button"
                onClick={onSendToRecount}
                disabled={interactionDisabled}
              >
                {recounting ? "Enviando para recontagem..." : "Enviar para recontagem"}
              </button>
            </div>
          )}
        </>
      </DataState>
    </Panel>
  );
}

export default memo(ApprovalDetailsPanel);
