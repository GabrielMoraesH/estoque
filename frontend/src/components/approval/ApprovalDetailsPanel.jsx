import { memo, useCallback } from "react";
import DataState from "../ui/DataState";
import CountingTrace from "../CountingTrace";
import Panel from "../ui/Panel";
import TableContainer from "../ui/TableContainer";
import Button from "../ui/Button";
import StatusPill, { getStatusPillVariant } from "../ui/StatusPill";
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
        <span aria-label={`Diferença de ${formatSignedNumber(item?.diferencaTotal)}, ${hasDifference ? "com divergência" : "sem divergência"}`}>
          {formatSignedNumber(item?.diferencaTotal)}
        </span>
      </td>
      <td>
        <Button
          variant="secondary"
          className="aprovacao-detail-button"
          onClick={handleOpenLocationDetails}
          disabled={interactionDisabled}
        >
          Ver localizações
        </Button>
      </td>
      <td>
        <Button
          variant="secondary"
          className="aprovacao-detail-button"
          onClick={handleOpenLotDetails}
          disabled={interactionDisabled}
        >
          Ver lotes
        </Button>
      </td>
      <td>
        <StatusPill variant={getStatusPillVariant(item?.status)}>{getItemStatusLabel(item?.status)}</StatusPill>
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
        <StatusPill variant={getStatusPillVariant(item?.status)}>{getItemStatusLabel(item?.status)}</StatusPill>
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
            <span aria-label={`Diferença de ${formatSignedNumber(item?.diferencaTotal)}, ${hasDifference ? "com divergência" : "sem divergência"}`}>
              {formatSignedNumber(item?.diferencaTotal)}
            </span>
          </strong>
        </div>
      </div>

      <CountingTrace trace={item?.countingTrace} compact />

      <div className="aprovacao-mobile-actions">
        <Button
          variant="secondary"
          className="aprovacao-detail-button"
          onClick={handleOpenLocationDetails}
          disabled={interactionDisabled}
        >
          Ver localizações
        </Button>

        <Button
          variant="secondary"
          className="aprovacao-detail-button"
          onClick={handleOpenLotDetails}
          disabled={interactionDisabled}
        >
          Ver lotes
        </Button>
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
    <section aria-label={`Detalhes da OC ${formatOcCode(selectedOC?.id)}`}>
      <Panel
        className="aprovacao-details"
        title={`Detalhes da OC ${formatOcCode(selectedOC?.id)}`}
        subtitle={`Responsável operacional: ${formatResponsibleName(selectedOC?.estoquista_nome)}`}
        headerClassName="aprovacao-details-header"
        actions={(
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={interactionDisabled}
          >
            Fechar
          </Button>
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
            <table className={`aprovacao-table${canRequestRecount ? " aprovacao-table--with-recount" : ""}`}>
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Saldo sistema</th>
                  <th scope="col">Saldo contado</th>
                  <th scope="col">Diferença</th>
                  <th scope="col">Localizações</th>
                  <th scope="col">Lotes</th>
                  <th scope="col">Status</th>
                  <th scope="col">Contagens</th>
                  {canRequestRecount && <th scope="col">Recontar</th>}
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
              <Button
                variant="danger"
                className="aprovacao-recount-button"
                onClick={onSendToRecount}
                disabled={interactionDisabled}
              >
                {recounting ? "Enviando para recontagem..." : "Enviar para recontagem"}
              </Button>
            </div>
          )}
        </>
      </DataState>
      </Panel>
    </section>
  );
}

export default memo(ApprovalDetailsPanel);
