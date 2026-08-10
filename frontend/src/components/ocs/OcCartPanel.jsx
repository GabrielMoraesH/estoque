import { memo, useCallback } from "react";
import FeedbackState from "../FeedbackState";
import Panel from "../ui/Panel";
import {
  formatBalance,
  formatLastCount,
  formatProductName
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";

const CartItem = memo(function CartItem({ item, removingDisabled, onRemoveFromCart }) {
  const safeItem = item || {};

  const handleRemove = useCallback(() => {
    onRemoveFromCart(safeItem.id);
  }, [safeItem.id, onRemoveFromCart]);

  return (
    <div className="gerar-oc-cart-item">
      <div>
        <strong>{formatProductName(safeItem)}</strong>
        <span>Saldo no sistema: {formatBalance(safeItem.saldo_sistema)}</span>
        <span>Última contagem: {formatLastCount(safeItem.ultima_contagem)}</span>
      </div>

      <button
        className="gerar-oc-remove-button"
        type="button"
        onClick={handleRemove}
        disabled={removingDisabled}
      >
        Remover
      </button>
    </div>
  );
});

function OcCartPanel({
  estoquistas,
  selectedEstoquista,
  onSelectEstoquista,
  cart,
  generating,
  canGenerate,
  onRemoveFromCart,
  onGenerate
}) {
  const safeEstoquistas = getRenderableList(estoquistas);
  const safeCart = getRenderableList(cart);
  const isGenerateDisabled = generating || safeCart.length === 0 || !selectedEstoquista;

  const handleSelectEstoquista = useCallback(
    (e) => onSelectEstoquista(e.target.value),
    [onSelectEstoquista]
  );

  return (
    <Panel
      className="gerar-oc-cart-card"
      title="Resumo da OC"
      subtitle="Revise os itens selecionados antes de gerar a ordem de contagem."
      headerClassName="gerar-oc-card-header"
    >
      <div className="field-group">
        <label htmlFor="estoquista-gerar-oc">Estoquista responsável</label>
        <select
          id="estoquista-gerar-oc"
          className="field-control"
          value={selectedEstoquista}
          onChange={handleSelectEstoquista}
          disabled={generating}
        > 
          <option value="">Selecione um estoquista</option>
          {safeEstoquistas.map((estoquista) => (
            <option key={estoquista.id} value={estoquista.id}>
              {estoquista.nome || "Sem nome"}
            </option>
          ))}
        </select>
      </div>

      <div className="gerar-oc-cart-list">
        {safeCart.length === 0 ? (
          <FeedbackState
            type="empty"
            title="Nenhum produto selecionado"
            message="Adicione produtos da lista para montar a ordem de contagem."
            compact
          />
        ) : (
          safeCart.map((item) => (
            <CartItem
              key={item.id || item.produto}
              item={item}
              removingDisabled={generating}
              onRemoveFromCart={onRemoveFromCart}
            />
          ))
        )}
      </div>

      <div className="gerar-oc-summary">
        <span>Total de itens</span>
        <strong>{safeCart.length}</strong>
        {canGenerate && (
          <button
            className="primary-button"
            type="button"
            onClick={onGenerate}
            disabled={isGenerateDisabled}
          >
            {generating ? "Gerando OC..." : "Gerar OC"}
          </button>
        )}
      </div>
    </Panel>
  );
}

export default memo(OcCartPanel);
