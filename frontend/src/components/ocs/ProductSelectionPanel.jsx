import { memo, useCallback } from "react";
import DataState from "../ui/DataState";
import Panel from "../ui/Panel";
import {
  formatBalance,
  formatLastCount,
  formatProductName
} from "../../utils/formatters";
import { getRenderableList } from "../../utils/ocData";

const ProductListItem = memo(function ProductListItem({
  produto,
  isInCart,
  canAddToCart,
  addDisabled,
  onAddToCart
}) {
  const handleAddToCart = useCallback(() => {
    if (produto) {
      onAddToCart(produto);
    }
  }, [onAddToCart, produto]);

  return (
    <article className="gerar-oc-product-item">
      <div className="gerar-oc-product-main">
        <strong className="gerar-oc-product-name">{formatProductName(produto)}</strong>

        <div className="gerar-oc-product-meta">
          <div className="gerar-oc-product-meta-item">
            <span>Saldo do sistema</span>
            <strong className="gerar-oc-product-balance">{formatBalance(produto?.saldo_sistema)}</strong>
          </div>

          <div className="gerar-oc-product-meta-item">
            <span>Última contagem</span>
            <strong className="gerar-oc-product-date">
              {formatLastCount(produto?.ultima_contagem)}
            </strong>
          </div>
        </div>
      </div>

      {canAddToCart && (
        <button
          className="gerar-oc-add-button"
          type="button"
          onClick={handleAddToCart}
          disabled={isInCart || addDisabled}
        >
          {isInCart ? "Adicionado" : "Adicionar"}
        </button>
      )}
    </article>
  );
});

function ProductSelectionPanel({
  loading,
  error,
  searchTerm,
  onSearchChange,
  produtos,
  isUsingMock,
  cartItemIds,
  canAddToCart,
  addDisabled,
  onAddToCart
}) {
  const safeProdutos = getRenderableList(produtos);
  const safeCartItemIds = cartItemIds instanceof Set ? cartItemIds : new Set();

  const handleSearchChange = useCallback(
    (e) => onSearchChange(e.target.value),
    [onSearchChange]
  );

  return (
    <Panel
      className="gerar-oc-product-card"
      title="Produtos disponíveis"
      subtitle={isUsingMock ? "Lista exibida em modo demonstrativo." : "Lista sincronizada com a base de produtos."}
      headerClassName="gerar-oc-card-header"
    >

      <div className="field-group gerar-oc-search-group">
        <label htmlFor="buscar-produto-gerar-oc">Buscar produto</label>
        <input
          id="buscar-produto-gerar-oc"
          className="field-control"
          type="text"
          placeholder="Digite o nome do produto"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={safeProdutos.length === 0}
        loadingTitle="Carregando produtos"
        loadingMessage="Aguarde enquanto a lista de produtos é preparada."
        errorTitle="Não foi possível carregar os produtos"
        emptyTitle="Nenhum produto encontrado"
        emptyMessage="Tente buscar por outro nome ou revise o termo digitado."
        panel={false}
      >
        <div className="gerar-oc-product-list">
          {safeProdutos.map((produto) => (
            <ProductListItem
              key={produto.id || produto.produto}
              produto={produto}
              isInCart={safeCartItemIds.has(produto.id)}
              canAddToCart={canAddToCart}
              addDisabled={addDisabled}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </DataState>
    </Panel>
  );
}

export default memo(ProductSelectionPanel);
