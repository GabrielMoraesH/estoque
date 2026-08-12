import Layout from "../components/Layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import BackButton from "../components/BackButton";
import PageHeader from "../components/ui/PageHeader";
import ProductSelectionPanel from "../components/ocs/ProductSelectionPanel";
import OcCartPanel from "../components/ocs/OcCartPanel";
import usePermissions from "../hooks/usePermissions";
import useEmpresa from "../hooks/useEmpresa";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import {
  asArray,
  buildOcItemsFromCart,
  filterProdutosByName,
  getSelectedItemIdSet,
  groupProdutosByName
} from "../utils/ocData";
import "../styles/app-pages.css";
import "../styles/gerar-oc.css";

function hasEmpresaAccess(estoquista, empresaId) {
  const empresas = Array.isArray(estoquista?.empresas) ? estoquista.empresas : [];

  if (!empresaId || empresas.length === 0) {
    return true;
  }

  return empresas.some((empresa) => Number(empresa?.id ?? empresa) === Number(empresaId));
}

function getGenerateOcErrorMessage(error) {
  const errorMessage = getFeedbackErrorMessage(error, feedbackMessages.oc.generateError);
  const errorCode = error?.data?.error?.code;

  if (errorCode === "VALIDATION_ERROR" && errorMessage === "Invalid request data") {
    return "Não foi possível gerar a OC. Verifique os produtos selecionados.";
  }

  return errorMessage;
}

function GerarOC() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canCreateOc } = usePermissions();
  const { activeEmpresa } = useEmpresa();
  const { showToast } = useToast();
  const { createOcWithProducts, fetchEstoquistas } = useOCs();
  const { fetchProdutos, getLocalizacoesPorProduto, isUsingMock } = useProdutos();
  const [produtos, setProdutos] = useState([]);
  const [estoquistas, setEstoquistas] = useState([]);
  const [selectedEstoquista, setSelectedEstoquista] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      setCart([]);
      setSelectedEstoquista("");

      try {
        const [produtosData, estoquistasData] = await Promise.all([
          fetchProdutos(),
          fetchEstoquistas({ nivel: 1 })
        ]);

        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        setProdutos(asArray(produtosData));
        setEstoquistas(asArray(estoquistasData));
      } catch (error) {
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadCreateDataError);
        setProdutos([]);
        setEstoquistas([]);
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (isCurrentRequest && empresaIdAtLoad === (activeEmpresa?.id || null)) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCurrentRequest = false;
    };
  }, [activeEmpresa?.id, fetchEstoquistas, fetchProdutos, showToast]);

  const produtosAgrupados = useMemo(() => groupProdutosByName(produtos), [produtos]);

  const produtosFiltrados = useMemo(
    () => filterProdutosByName(produtosAgrupados, searchTerm),
    [produtosAgrupados, searchTerm]
  );

  const estoquistasPrimeiraContagem = useMemo(
    () => asArray(estoquistas).filter((estoquista) => (
      estoquista?.ativo !== false &&
      Number(estoquista?.nivel_estoquista) === 1 &&
      hasEmpresaAccess(estoquista, activeEmpresa?.id)
    )),
    [activeEmpresa?.id, estoquistas]
  );

  const cartItemIds = useMemo(() => getSelectedItemIdSet(cart), [cart]);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  const handleSelectEstoquista = useCallback((value) => {
    setSelectedEstoquista(value);
  }, []);

  const handleAddToCart = useCallback((produto) => {
    if (!canCreateOc || generating) {
      return;
    }

    if (!produto?.id) {
      return;
    }

    if (cartItemIds.has(produto.id)) {
      showToast(feedbackMessages.oc.addDuplicateInfo, "info");
      return;
    }

    setCart((current) => [...asArray(current), produto]);
    showToast(feedbackMessages.oc.addSuccess);
  }, [canCreateOc, cartItemIds, generating, showToast]);

  const handleRemoveFromCart = useCallback((id) => {
    if (!canCreateOc || generating) {
      return;
    }

    setCart((current) => asArray(current).filter((item) => item?.id !== id));
  }, [canCreateOc, generating]);

  const handleGenerateOC = useCallback(async () => {
    if (!canCreateOc || generating) {
      return;
    }

    if (!selectedEstoquista) {
      showToast(feedbackMessages.oc.selectEstoquista, "info");
      return;
    }

    const safeCart = asArray(cart).filter(Boolean);

    if (safeCart.length === 0) {
      showToast(feedbackMessages.oc.selectProduct, "info");
      return;
    }

    setGenerating(true);

    const itemsToCreate = buildOcItemsFromCart(safeCart, produtos, getLocalizacoesPorProduto);

    try {
      const res = await createOcWithProducts({
        estoquista_id: selectedEstoquista,
        items: itemsToCreate
      });

      if (res?.id) {
        showToast(feedbackMessages.oc.generateSuccess);
        setCart([]);
        setSelectedEstoquista("");
        navigate(`/gestor/oc/${res.id}`, {
          replace: true,
          state: {
            from: "/gestor"
          }
        });
        return;
      }

      showToast(feedbackMessages.oc.generateError, "error");
    } catch (error) {
      showToast(getGenerateOcErrorMessage(error), "error");
    } finally {
      setGenerating(false);
    }
  }, [
    canCreateOc,
    cart,
    createOcWithProducts,
    generating,
    getLocalizacoesPorProduto,
    navigate,
    produtos,
    selectedEstoquista,
    showToast
  ]);

  if (!canCreateOc) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell gerar-oc-page">
        <BackButton fallbackTo={location.state?.from || "/gestor"} />

        <PageHeader
          title="Gerar ordem de contagem"
          subtitle="Selecione os produtos, monte a OC e escolha o estoquista responsável pela contagem."
        />

        <div className="gerar-oc-grid">
          <ProductSelectionPanel
            loading={loading}
            error={loadError}
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            produtos={produtosFiltrados}
            isUsingMock={isUsingMock}
            cartItemIds={cartItemIds}
            canAddToCart={canCreateOc}
            addDisabled={generating}
            onAddToCart={handleAddToCart}
          />

          <OcCartPanel
            estoquistas={estoquistasPrimeiraContagem}
            loadingEstoquistas={loading}
            selectedEstoquista={selectedEstoquista}
            onSelectEstoquista={handleSelectEstoquista}
            cart={cart}
            generating={generating}
            canGenerate={canCreateOc}
            onRemoveFromCart={handleRemoveFromCart}
            onGenerate={handleGenerateOC}
          />
        </div>
      </div>
    </Layout>
  );
}

export default GerarOC;
