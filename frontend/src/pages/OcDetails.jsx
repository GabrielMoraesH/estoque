import Layout from "../components/Layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import ConfirmModal from "../components/ui/ConfirmModal";
import ProductCountingSection from "../components/products/ProductCountingSection";
import OcEmpresaBadge from "../components/ocs/OcEmpresaBadge";
import useAuth from "../hooks/useAuth";
import usePermissions from "../hooks/usePermissions";
import useEmpresa from "../hooks/useEmpresa";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";
import { useToast } from "../components/ToastProvider";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import {
  asArray,
  attachLocationsToItems,
  getActionableOcItems,
  getUniqueProductNames
} from "../utils/ocData";
import { formatOcCode } from "../utils/formatters";
import "../styles/produto.css";
import "../styles/app-pages.css";

function OcDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { canFinalizeOc, canViewCountingItem } = usePermissions();
  const { activeEmpresa } = useEmpresa();
  const { fetchEstoquistaOCs, fetchOcItems, finalizeOc } = useOCs();
  const { fetchProdutos, getLocalizacoesPorProduto } = useProdutos();
  const { showToast } = useToast();
  const [oc, setOc] = useState(null);
  const [items, setItems] = useState([]);
  const [produtosExterno, setProdutosExterno] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadItems = async () => {
      setLoading(true);
      setLoadError("");
      setOc(null);
      setItems([]);
      setSelectedProduct("");

      try {
        const [ocsData, data, produtosData] = await Promise.all([
          fetchEstoquistaOCs({
            role: user?.role,
            id: user?.id
          }),
          fetchOcItems(id),
          fetchProdutos()
        ]);

        const actionableItems = getActionableOcItems(data);

        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const selectedOc = asArray(ocsData).find(
          (currentOc) => String(currentOc?.id) === String(id)
        );

        setOc(selectedOc || null);
        setItems(actionableItems);
        setProdutosExterno(asArray(produtosData));
        setSelectedProduct((current) => {
          const preferredProduct = location.state?.selectedProduct;
          const hasPreferredProduct = actionableItems.some(
            (item) => item?.produto === preferredProduct
          );

          if (hasPreferredProduct) {
            return preferredProduct;
          }

          return current && actionableItems.some((item) => item?.produto === current)
            ? current
            : actionableItems[0]?.produto || "";
        });
      } catch (error) {
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadItemsError);
        setOc(null);
        setItems([]);
        setSelectedProduct("");
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (isCurrentRequest && empresaIdAtLoad === (activeEmpresa?.id || null)) {
          setLoading(false);
        }
      }
    };

    if (canViewCountingItem) {
      loadItems();
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [
    activeEmpresa?.id,
    canViewCountingItem,
    fetchEstoquistaOCs,
    fetchOcItems,
    fetchProdutos,
    id,
    location.state?.selectedProduct,
    showToast,
    user?.id,
    user?.role
  ]);

  const groupedProducts = useMemo(() => {
    return getUniqueProductNames(items);
  }, [items]);

  const selectedProductItems = useMemo(() => {
    return attachLocationsToItems(
      items,
      produtosExterno,
      selectedProduct,
      getLocalizacoesPorProduto
    );
  }, [getLocalizacoesPorProduto, items, produtosExterno, selectedProduct]);

  const progress = useMemo(() => ({
    total: items.length,
    counted: items.filter((item) => item?.status === "contado").length
  }), [items]);
  const readyToFinalize = progress.total > 0 && progress.counted === progress.total;

  const handleSelectedProductChange = useCallback((e) => {
    setSelectedProduct(e.target.value);
  }, []);

  const handleOpenItem = useCallback((item) => {
    const itemId = item?.id;

    if (!itemId) {
      return;
    }

    navigate(`/contar/${id}/${itemId}`, {
      state: {
        from: location.state?.from || "/minhas-ocs",
        selectedProduct,
        newModel: Boolean(item?.new_model || item?.oc_localizacao_id),
        ocLocalizacaoId: item?.oc_localizacao_id || null
      }
    });
  }, [id, location.state?.from, navigate, selectedProduct]);

  const handleFinalize = useCallback(async () => {
    if (!readyToFinalize || finalizing) return;
    setFinalizing(true);
    try {
      await finalizeOc(id);
      showToast(feedbackMessages.oc.finalizeSuccess);
      navigate("/minhas-ocs", { replace: true });
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.oc.finalizeError), "error");
    } finally {
      setFinalizing(false);
      setShowFinalizeConfirm(false);
    }
  }, [finalizeOc, finalizing, id, navigate, readyToFinalize, showToast]);

  if (!canViewCountingItem) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <BackButton fallbackTo="/minhas-ocs" />

        <PageHeader
          title={`OC ${formatOcCode(id)}`}
          subtitle="Selecione um produto e acompanhe o status de cada localização."
        />

        <div className="oc-detail-company-row">
          <span>Empresa</span>
          <OcEmpresaBadge oc={oc} />
        </div>

        {!loading && !loadError && (
          <Panel className="oc-operational-progress">
            <div className="oc-progress-header">
              <div className="oc-progress-copy">
                <strong>Progresso da contagem</strong>
                <p>{progress.counted} de {progress.total} localizações contadas</p>
              </div>
              {canFinalizeOc && <Button className="oc-finalize-button" disabled={!readyToFinalize || finalizing} onClick={() => setShowFinalizeConfirm(true)}>{finalizing ? "Finalizando..." : "Finalizar contagem"}</Button>}
            </div>
            {!readyToFinalize && progress.total > 0 && <p className="oc-progress-hint">Conclua as localizações pendentes para finalizar.</p>}
          </Panel>
        )}

        <DataState
          loading={loading}
          error={loadError}
          empty={!loading && !loadError && items.length === 0}
          loadingTitle="Carregando itens da OC"
          loadingMessage="Buscando produtos e localizações para contagem."
          errorTitle="Não foi possível carregar os itens"
          emptyTitle="Nenhum item disponível para contagem"
          emptyMessage="Esta OC não possui itens pendentes ou todos os itens já foram aprovados."
        >
          <ProductCountingSection
            products={groupedProducts}
            selectedProduct={selectedProduct}
            locationItems={selectedProductItems}
            canOpenItem={canViewCountingItem}
            onSelectedProductChange={handleSelectedProductChange}
            onOpenItem={handleOpenItem}
          />
        </DataState>
        <ConfirmModal open={showFinalizeConfirm} title="Finalizar contagem" message="Confirma a finalização desta contagem?" confirmLabel={finalizing ? "Finalizando..." : "Finalizar contagem"} cancelLabel="Cancelar" variant="primary" loading={finalizing} onCancel={() => !finalizing && setShowFinalizeConfirm(false)} onConfirm={handleFinalize} />
      </div>
    </Layout>
  );
}

export default OcDetails;
