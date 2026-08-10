import { memo, useCallback } from "react";
import {
  formatLocationName,
  formatProductName,
  getItemStatusLabel,
  getStatusClassName
} from "../../utils/formatters";

function ProductLocationCard({ item, productName, canOpenItem, onOpenItem }) {
  const safeItem = item || {};
  const isCounted = safeItem.status === "contado";
  const isActionDisabled = !canOpenItem || !safeItem.id || isCounted;

  const handleOpenItem = useCallback(() => {
    if (isActionDisabled) {
      return;
    }

    onOpenItem(safeItem.id);
  }, [isActionDisabled, onOpenItem, safeItem.id]);

  return (
    <div
      className={`card-produto ${getStatusClassName(safeItem.status, "location-status", "pendente")}`}
      onClick={handleOpenItem}
    >
      <div className="desktop-only">
        <p><strong>{formatProductName(productName || safeItem.produto)}</strong></p>
        <p>Localização: {formatLocationName(safeItem.location?.endereco)}</p>
        <p>Status: {getItemStatusLabel(safeItem.status)}</p>
        {isCounted && <p>Este endereço já foi contado.</p>}
      </div>

      <div className="mobile-only">
        <div className="product-card-header">
          <strong>{formatProductName(productName || safeItem.produto)}</strong>
          <span className="aprovacao-item-status">{getItemStatusLabel(safeItem.status)}</span>
        </div>

        <div className="product-card-meta">
          <p>Localização: {formatLocationName(safeItem.location?.endereco)}</p>
          {isCounted && <p>Este endereço já foi contado.</p>}
        </div>

        <button
          className="product-card-action"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenItem();
          }}
          disabled={isActionDisabled}
        >
          {isCounted ? "Contagem concluída" : "Abrir item para contagem"}
        </button>
      </div>
    </div>
  );
}

export default memo(ProductLocationCard);
