import { memo, useCallback, useMemo } from "react";
import { formatLocationName, formatLot, formatProductName, formatQuantity, getItemStatusLabel, getStatusClassName } from "../../utils/formatters";

function ProductLocationCard({ item, productName, canOpenItem, onOpenItem }) {
  const safeItem = useMemo(() => item || {}, [item]);
  const isCounted = safeItem.status === "contado";
  const isActionDisabled = !canOpenItem || !safeItem.id || isCounted;
  const locationName = formatLocationName(safeItem.location?.endereco);
  const accessibleActionName = isCounted
    ? `Contagem concluída para ${formatProductName(productName || safeItem.produto)} — ${locationName}`
    : `Contar localização de ${formatProductName(productName || safeItem.produto)} — ${locationName}`;
  const handleOpenItem = useCallback(() => {
    if (!isActionDisabled) onOpenItem(safeItem);
  }, [isActionDisabled, onOpenItem, safeItem]);
  return (
    <button
      className={`card-produto ${getStatusClassName(safeItem.status, "location-status", "pendente")}`}
      type="button"
      aria-label={accessibleActionName}
      onClick={handleOpenItem}
      disabled={isActionDisabled}
    >
      <span className="product-card-header">
        <strong>{formatProductName(productName || safeItem.produto)}</strong>
        <span className="aprovacao-item-status">Status: {getItemStatusLabel(safeItem.status)}</span>
      </span>
      <span className="product-card-meta">
        <span>Localização: {locationName}</span>
        {safeItem.codigo_barras_snapshot && <span>Código de barras: {safeItem.codigo_barras_snapshot}</span>}
        {safeItem.validade_snapshot && <span>Validade: {safeItem.validade_snapshot}</span>}
        {isCounted && <span>Quantidade: {formatQuantity(safeItem.quantidade)} · Lote: {formatLot(safeItem.lote)}</span>}
      </span>
      <span className="product-card-action">
        {isCounted ? "Contagem concluída" : "Contar localização"}
      </span>
    </button>
  );
}

export default memo(ProductLocationCard);
