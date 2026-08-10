import { memo } from "react";
import Panel from "../ui/Panel";
import ProductLocationCard from "./ProductLocationCard";
import { getRenderableList } from "../../utils/ocData";

function ProductCountingSection({
  products,
  selectedProduct,
  locationItems,
  canOpenItem,
  onSelectedProductChange,
  onOpenItem
}) {
  const safeProducts = getRenderableList(products);
  const safeLocationItems = getRenderableList(locationItems);

  return (
    <>
      {safeProducts.length > 0 && (
        <Panel className="product-selector-card">
          <div className="field-group">
            <label htmlFor="oc-item-select">Produto da OC</label>
            <select
              id="oc-item-select"
              className="field-control"
              value={selectedProduct}
              onChange={onSelectedProductChange}
            >
              {safeProducts.map((produto) => (
                <option key={produto} value={produto}>
                  {produto}
                </option>
              ))}
            </select>
          </div>
        </Panel>
      )}

      {safeLocationItems.length > 0 && (
        <div className="product-location-list">
          {safeLocationItems.map((item) => (
            <ProductLocationCard
              key={item.id}
              item={item}
              productName={selectedProduct}
              canOpenItem={canOpenItem}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default memo(ProductCountingSection);
