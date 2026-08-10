import { memo, useCallback } from "react";
import FeedbackState from "../FeedbackState";
import CountingTrace from "../CountingTrace";
import Panel from "../ui/Panel";
import SectionHeader from "../ui/SectionHeader";
import TableContainer from "../ui/TableContainer";
import {
  formatBalance,
  formatProductName,
  formatSignedNumber,
  getItemStatusLabel
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";

const GestorDetailItemRow = memo(function GestorDetailItemRow({ item, onOpenLotDetails }) {
  const handleOpenLotDetails = useCallback(() => {
    if (item) {
      onOpenLotDetails(item);
    }
  }, [item, onOpenLotDetails]);

  return (
    <tr>
      <td>{formatProductName(item)}</td>
      <td>{formatBalance(item?.saldoSistema)}</td>
      <td>{formatBalance(item?.saldoContado)}</td>
      <td>{formatSignedNumber(item?.diferenca)}</td>
      <td>
        <button className="aprovacao-detail-button" type="button" onClick={handleOpenLotDetails}>
          Ver lotes
        </button>
      </td>
      <td>
        <span className="aprovacao-item-status">{getItemStatusLabel(item?.consolidatedStatus)}</span>
      </td>
      <td>
        <CountingTrace trace={item?.countingTrace} compact />
      </td>
    </tr>
  );
});

const GestorDetailMobileCard = memo(function GestorDetailMobileCard({ item, onOpenLotDetails }) {
  const handleOpenLotDetails = useCallback(() => {
    if (item) {
      onOpenLotDetails(item);
    }
  }, [item, onOpenLotDetails]);

  return (
    <article className="gestor-item-mobile-card">
      <div className="gestor-item-mobile-header">
        <strong>{formatProductName(item)}</strong>
        <span className="aprovacao-item-status">{getItemStatusLabel(item?.consolidatedStatus)}</span>
      </div>

      <div className="gestor-item-mobile-grid">
        <div className="gestor-item-mobile-metric">
          <span>Saldo do sistema</span>
          <strong>{formatBalance(item?.saldoSistema)}</strong>
        </div>
        <div className="gestor-item-mobile-metric">
          <span>Saldo contado</span>
          <strong>{formatBalance(item?.saldoContado)}</strong>
        </div>
        <div className="gestor-item-mobile-metric">
          <span>Diferença</span>
          <strong>{formatSignedNumber(item?.diferenca)}</strong>
        </div>
      </div>

      <CountingTrace trace={item?.countingTrace} compact />

      <button className="aprovacao-detail-button gestor-item-mobile-button" type="button" onClick={handleOpenLotDetails}>
        Ver lotes
      </button>
    </article>
  );
});

function GestorOcItemsTable({ items, onOpenLotDetails }) {
  const safeItems = getRenderableList(items);

  return (
    <Panel className="gestor-details-card">
      <SectionHeader
        className="page-header"
        title="Itens da ordem"
        subtitle="Visão consolidada por produto para facilitar a análise do resultado da contagem."
      />

      {safeItems.length === 0 ? (
        <FeedbackState
          type="empty"
          title="Nenhum item encontrado"
          message="Ainda não há itens disponíveis para exibir nesta ordem."
        />
      ) : (
        <>
          <TableContainer className="gestor-items-table-wrapper desktop-only">
            <table className="gestor-items-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Saldo do sistema</th>
                  <th>Saldo contado</th>
                  <th>Diferença</th>
                  <th>Lotes</th>
                  <th>Status</th>
                  <th>Contagens</th>
                </tr>
              </thead>
              <tbody>
                {safeItems.map((item) => (
                  <GestorDetailItemRow
                    key={item?.produto || "produto"}
                    item={item}
                    onOpenLotDetails={onOpenLotDetails}
                  />
                ))}
              </tbody>
            </table>
          </TableContainer>

          <div className="gestor-items-mobile-list mobile-only">
            {safeItems.map((item) => (
              <GestorDetailMobileCard
                key={item?.produto || "produto"}
                item={item}
                onOpenLotDetails={onOpenLotDetails}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

export default memo(GestorOcItemsTable);
