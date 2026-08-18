import { memo, useCallback } from "react";
import FeedbackState from "../FeedbackState";
import Panel from "../ui/Panel";
import {
  formatBalance,
  formatLastCount,
  formatProductName
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";
import { getProdutoIdentity } from "../../contracts/produtosContract";

const CartItem = memo(function CartItem({ item, removingDisabled, onRemoveFromCart }) {
  const safeItem = item || {};
  const itemIdentity = getProdutoIdentity(safeItem);

  const handleRemove = useCallback(() => {
    onRemoveFromCart(itemIdentity);
  }, [itemIdentity, onRemoveFromCart]);

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
  loadingEstoquistas,
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
  const isGenerateDisabled = generating || loadingEstoquistas || safeCart.length === 0 || !selectedEstoquista;

  const handleSelectEstoquista = useCallback(
    (e) => onSelectEstoquista(e.target.value),
    [onSelectEstoquista]
  );

  return (
    <div role="form" aria-label="Gerar ordem de contagem">
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
          disabled={generating || loadingEstoquistas || safeEstoquistas.length === 0}
        > 
          <option value="">
            {loadingEstoquistas ? "Carregando estoquistas..." : "Selecione um estoquista"}
          </option>
          {safeEstoquistas.map((estoquista) => (
            <option key={estoquista.id} value={estoquista.id}>
              {estoquista.nome || "Sem nome"}
            </option>
          ))}
        </select>
        {safeEstoquistas.length === 0 && !loadingEstoquistas && (
          <p className="gerar-oc-field-message">
            Nenhum estoquista de ní­vel 1 disponí­vel para esta filial.
          </p>
        )}
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
              key={getProdutoIdentity(item) || item.id || item.produto}
              item={item}
              removingDisabled={generating}
              onRemoveFromCart={onRemoveFromCart}
            />
          ))
        )}
        </div>

        <div className="gerar-oc-summary">
        <span>Total de produtos</span>
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
    </div>
  );
}

export default memo(OcCartPanel);
