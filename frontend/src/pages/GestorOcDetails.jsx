import Layout from "../components/Layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import ApprovalDetailModal from "../components/approval/ApprovalDetailModal";
import GestorOcItemsTable from "../components/ocs/GestorOcItemsTable";
import GestorOcSummaryPanel from "../components/ocs/GestorOcSummaryPanel";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";
import { useToast } from "../components/ToastProvider";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import {
  formatOcCode,
  formatProductName
} from "../utils/formatters";
import {
  asArray,
  buildGestorLotDetailRows,
  groupItemsForGestorDetails,
  summarizeOcItems
} from "../utils/ocData";
import "../styles/app-pages.css";
import "../styles/aprovacao.css";
import "../styles/oc.css";

function GestorOcDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { activeEmpresa } = useEmpresa();
  const { canViewGestorOcs } = usePermissions();
  const { fetchGestorOCs, fetchOcItems } = useOCs();
  const { fetchProdutos, getLocalizacoesPorProduto } = useProdutos();
  const { showToast } = useToast();
  const [oc, setOc] = useState(null);
  const [items, setItems] = useState([]);
  const [produtosExterno, setProdutosExterno] = useState([]);
  const [detailModal, setDetailModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadedEmpresaId, setLoadedEmpresaId] = useState(null);

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      setOc(null);
      setItems([]);
      setProdutosExterno([]);
      setDetailModal(null);
      setLoadedEmpresaId(null);

      try {
        const ocsData = await fetchGestorOCs({
          role: user?.role,
          id: user?.id
        });
        const selectedOc = asArray(ocsData).find(
          (currentOc) => String(currentOc?.id) === String(id)
        );

        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        if (!selectedOc) {
          setOc(null);
          setItems([]);
          setProdutosExterno([]);
          setLoadedEmpresaId(empresaIdAtLoad);
          return;
        }

        setOc(selectedOc);

        const [itemsData, produtosData] = await Promise.all([
          fetchOcItems(id),
          fetchProdutos()
        ]);

        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        setItems(asArray(itemsData));
        setProdutosExterno(asArray(produtosData));
        setLoadedEmpresaId(empresaIdAtLoad);
      } catch (error) {
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadDetailsError);
        setOc(null);
        setItems([]);
        setLoadedEmpresaId(empresaIdAtLoad);
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (isCurrentRequest && empresaIdAtLoad === (activeEmpresa?.id || null)) {
          setLoading(false);
        }
      }
    };

    if (user?.id && canViewGestorOcs) {
      loadData();
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [
    activeEmpresa?.id,
    canViewGestorOcs,
    fetchGestorOCs,
    fetchOcItems,
    fetchProdutos,
    id,
    showToast,
    user?.id,
    user?.role
  ]);

  const summary = useMemo(() => {
    return summarizeOcItems(items);
  }, [items]);
  const isCurrentEmpresaLoaded = loadedEmpresaId === (activeEmpresa?.id || null);
  const effectiveLoading = loading || !isCurrentEmpresaLoaded;

  const groupedItems = useMemo(() => {
    return groupItemsForGestorDetails(items, produtosExterno, getLocalizacoesPorProduto);
  }, [getLocalizacoesPorProduto, items, produtosExterno]);

  const openLotDetails = useCallback((item) => {
    if (!item) {
      return;
    }

    setDetailModal({
      title: `Lotes de ${formatProductName(item, "produto")}`,
      rows: buildGestorLotDetailRows(item)
    });
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal(null);
  }, []);

  if (!canViewGestorOcs) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <BackButton fallbackTo="/gestor" />

        <PageHeader
          title={`OC ${formatOcCode(id)}`}
          subtitle="Acompanhe o resumo da ordem, os itens envolvidos e o andamento da contagem."
        />

        <DataState
          loading={effectiveLoading}
          error={loadError}
          empty={!isCurrentEmpresaLoaded || !oc}
          loadingTitle="Carregando detalhes da OC"
          loadingMessage="Buscando resumo, itens e localizações da ordem."
          errorTitle="Não foi possível carregar a OC"
          emptyTitle="OC não localizada"
          emptyMessage="A ordem solicitada não foi encontrada para este usuário."
        >
          {isCurrentEmpresaLoaded && oc ? (
            <>
              <GestorOcSummaryPanel
                oc={oc}
                summary={summary}
              />

              <GestorOcItemsTable
                items={groupedItems}
                onOpenLotDetails={openLotDetails}
              />
            </>
          ) : null}
        </DataState>
      </div>

      <ApprovalDetailModal
        detailModal={detailModal}
        onClose={handleCloseDetailModal}
      />
    </Layout>
  );
}

export default GestorOcDetails;
