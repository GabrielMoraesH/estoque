import { memo, useCallback, useMemo } from "react";
import { formatLocationName, formatLot, formatProductName, formatQuantity, getItemStatusLabel, getStatusClassName } from "../../utils/formatters";

function ProductLocationCard({ item, productName, canOpenItem, onOpenItem }) {
  const safeItem = useMemo(() => item || {}, [item]);
  const isCounted = safeItem.status === "contado";
  const isActionDisabled = !canOpenItem || !safeItem.id || isCounted;
  const handleOpenItem = useCallback(() => {
    if (!isActionDisabled) onOpenItem(safeItem);
  }, [isActionDisabled, onOpenItem, safeItem]);
  const details = <>
    <p>Localização: {formatLocationName(safeItem.location?.endereco)}</p>
    {safeItem.codigo_barras_snapshot && <p>Código de barras: {safeItem.codigo_barras_snapshot}</p>}
    {safeItem.validade_snapshot && <p>Validade: {safeItem.validade_snapshot}</p>}
    {isCounted && <p>Quantidade: {formatQuantity(safeItem.quantidade)} · Lote: {formatLot(safeItem.lote)}</p>}
  </>;

  return (
    <div className={`card-produto ${getStatusClassName(safeItem.status, "location-status", "pendente")}`} onClick={handleOpenItem}>
      <div className="desktop-only">
        <p><strong>{formatProductName(productName || safeItem.produto)}</strong></p>
        {details}<p>Status: {getItemStatusLabel(safeItem.status)}</p>
      </div>
      <div className="mobile-only">
        <div className="product-card-header"><strong>{formatProductName(productName || safeItem.produto)}</strong><span className="aprovacao-item-status">{getItemStatusLabel(safeItem.status)}</span></div>
        <div className="product-card-meta">{details}</div>
        <button className="product-card-action" type="button" onClick={(event) => { event.stopPropagation(); handleOpenItem(); }} disabled={isActionDisabled}>
          {isCounted ? "Contagem concluída" : "Contar localização"}
        </button>
      </div>
    </div>
  );
}

export default memo(ProductLocationCard);
