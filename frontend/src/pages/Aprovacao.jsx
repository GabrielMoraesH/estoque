import Layout from "../components/Layout";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import BackButton from "../components/BackButton";
import PageHeader from "../components/ui/PageHeader";
import ConfirmModal from "../components/ui/ConfirmModal";
import ApprovalOcList from "../components/approval/ApprovalOcList";
import ApprovalDetailsPanel from "../components/approval/ApprovalDetailsPanel";
import ApprovalDetailModal from "../components/approval/ApprovalDetailModal";
import RecountAssignmentModal from "../components/approval/RecountAssignmentModal";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";
import {
  feedbackMessages,
  getFeedbackErrorMessage
} from "../utils/feedbackMessages";
import { formatProductName } from "../utils/formatters";
import {
  asArray,
  buildApprovalLocationDetailRows,
  buildLocationLotDetailRows,
  getApprovalReviewItems,
  groupItemsForApproval
} from "../utils/ocData";
import "../styles/app-pages.css";
import "../styles/aprovacao.css";

function Aprovacao() {
  const { user } = useAuth();
  const { activeEmpresa } = useEmpresa();
  const activeEmpresaIdRef = useRef(activeEmpresa?.id || null);
  const location = useLocation();
  const navigate = useNavigate();
  const { canApproveOc, canRequestRecount } = usePermissions();
  const { showToast } = useToast();
  const {
    approveOc,
    fetchApprovalOCs,
    fetchEstoquistas,
    fetchOcItems,
    sendOcItemsToRecount
  } = useOCs();
  const { fetchProdutos, getLocalizacoesPorProduto } = useProdutos();
  const [ocs, setOcs] = useState([]);
  const [selectedOC, setSelectedOC] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [produtosExterno, setProdutosExterno] = useState([]);
  const [itemsToRecount, setItemsToRecount] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvalError, setApprovalError] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [approvingId, setApprovingId] = useState(null);
  const [recounting, setRecounting] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [openingDetailsId, setOpeningDetailsId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [recountModal, setRecountModal] = useState(null);
  const [estoquistas, setEstoquistas] = useState([]);
  const [loadingEstoquistas, setLoadingEstoquistas] = useState(false);
  const [selectedRecountEstoquistaId, setSelectedRecountEstoquistaId] = useState("");

  useEffect(() => {
    activeEmpresaIdRef.current = activeEmpresa?.id || null;
  }, [activeEmpresa?.id]);

  const loadOCs = useCallback(async ({ showLoading = true } = {}) => {
    const empresaIdAtLoad = activeEmpresa?.id || null;

    if (showLoading) {
      setLoading(true);
    }
    setApprovalError("");
    setSelectedOC(null);
    setSelectedItems([]);
    setItemsToRecount([]);
    setDetailsError("");
    setDetailsLoading(false);
    setDetailModal(null);
    setOpeningDetailsId(null);
    setConfirmation(null);
    setRecountModal(null);
    setSelectedRecountEstoquistaId("");
    setEstoquistas([]);
    setLoadingEstoquistas(false);

    try {
      const data = await fetchApprovalOCs({
        role: user?.role,
        id: user?.id
      });

      if (empresaIdAtLoad !== activeEmpresaIdRef.current) {
        return;
      }

      setOcs(asArray(data));
    } catch (error) {
      if (empresaIdAtLoad !== activeEmpresaIdRef.current) {
        return;
      }

      const message = getFeedbackErrorMessage(error, feedbackMessages.approval.loadError);
      setOcs([]);
      setApprovalError(message);
      showToast(message, "error");
    } finally {
      if (showLoading && empresaIdAtLoad === activeEmpresaIdRef.current) {
        setLoading(false);
      }
    }
  }, [activeEmpresa?.id, fetchApprovalOCs, showToast, user?.id, user?.role]);

  useEffect(() => {
    if (canApproveOc) {
      loadOCs();
    }
  }, [canApproveOc, loadOCs]);

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadProdutos = async () => {
      try {
        const data = await fetchProdutos();

        if (!isCurrentRequest || empresaIdAtLoad !== activeEmpresaIdRef.current) {
          return;
        }

        setProdutosExterno(asArray(data));
      } catch {
        if (!isCurrentRequest || empresaIdAtLoad !== activeEmpresaIdRef.current) {
          return;
        }

        setProdutosExterno([]);
      }
    };

    setProdutosExterno([]);
    loadProdutos();

    return () => {
      isCurrentRequest = false;
    };
  }, [activeEmpresa?.id, fetchProdutos]);

  const groupedSelectedItems = useMemo(() => {
    return groupItemsForApproval(selectedItems, produtosExterno, getLocalizacoesPorProduto);
  }, [getLocalizacoesPorProduto, selectedItems, produtosExterno]);

  const itemsToRecountSet = useMemo(() => new Set(itemsToRecount), [itemsToRecount]);

  const resetSelectedOcState = useCallback(({ keepSelectedOc = false } = {}) => {
    if (!keepSelectedOc) {
      setSelectedOC(null);
    }

    setSelectedItems([]);
    setItemsToRecount([]);
    setDetailsError("");
    setDetailsLoading(false);
    setDetailModal(null);
    setOpeningDetailsId(null);
    setConfirmation(null);
    setRecountModal(null);
    setSelectedRecountEstoquistaId("");
  }, []);

  const handleOpenDetails = useCallback(async (oc) => {
    if (!oc?.id || detailsLoading || recounting || approvingId || confirmation || recountModal) {
      return;
    }

    setOpeningDetailsId(oc.id);
    setSelectedOC(oc);
    setSelectedItems([]);
    setItemsToRecount([]);
    setDetailsError("");
    setDetailsLoading(true);
    setDetailModal(null);

    try {
      const items = await fetchOcItems(oc.id);
      setSelectedItems(getApprovalReviewItems(items));
    } catch (error) {
      const message = getFeedbackErrorMessage(error, feedbackMessages.approval.loadDetailsError);
      setDetailsError(message);
      showToast(message, "error");
    } finally {
      setDetailsLoading(false);
      setOpeningDetailsId(null);
    }
  }, [approvingId, confirmation, detailsLoading, fetchOcItems, recountModal, recounting, showToast]);

  useEffect(() => {
    const selectedOcId = location.state?.selectedOcId;

    if (!selectedOcId || loading) {
      return;
    }

    const ocToOpen = asArray(ocs).find((oc) => String(oc?.id) === String(selectedOcId));

    if (ocToOpen) {
      handleOpenDetails(ocToOpen);
    }

    navigate(location.pathname, {
      replace: true,
      state: location.state?.from
        ? {
            from: location.state.from
          }
        : null
    });
  }, [handleOpenDetails, loading, location.pathname, location.state, navigate, ocs]);

  useEffect(() => {
    if (!selectedOC) {
      return;
    }

    const currentSelectedOc = asArray(ocs).find((oc) => oc?.id === selectedOC.id);

    if (!currentSelectedOc) {
      resetSelectedOcState();
      return;
    }

    if (currentSelectedOc !== selectedOC) {
      setSelectedOC(currentSelectedOc);
    }
  }, [ocs, resetSelectedOcState, selectedOC]);

  const handleToggleRecountGroup = useCallback((itemIds) => {
    const safeItemIds = Array.isArray(itemIds) ? itemIds : [];

    setItemsToRecount((current) => {
      const currentIds = new Set(current);
      const allSelected = safeItemIds.every((currentId) => currentIds.has(currentId));

      if (allSelected) {
        const itemIdsToRemove = new Set(safeItemIds);
        return current.filter((currentId) => !itemIdsToRemove.has(currentId));
      }

      return [...new Set([...current, ...safeItemIds])];
    });
  }, []);

  const isGroupMarkedForRecount = useCallback((itemIds) => {
    const safeItemIds = Array.isArray(itemIds) ? itemIds : [];
    return safeItemIds.length > 0 && safeItemIds.every((itemId) => itemsToRecountSet.has(itemId));
  }, [itemsToRecountSet]);

  const handleApprove = useCallback(async (id) => {
    if (!canApproveOc || !id || approvingId || recounting || detailsLoading || confirmation || recountModal) {
      return;
    }

    setConfirmation({ type: "approve", ocId: id });
  }, [approvingId, canApproveOc, confirmation, detailsLoading, recountModal, recounting]);

  const handleCancelConfirmation = useCallback(() => {
    if (!approvingId && !recounting) {
      setConfirmation(null);
    }
  }, [approvingId, recounting]);

  const handleConfirmApprove = useCallback(async () => {
    const id = confirmation?.type === "approve" ? confirmation.ocId : null;

    if (!canApproveOc || !id || approvingId || recounting || detailsLoading) {
      return;
    }

    setApprovingId(id);

    try {
      await approveOc(id);
      showToast(feedbackMessages.approval.approveSuccess);
      setOcs((current) => asArray(current).filter((oc) => oc?.id !== id));

      if (selectedOC?.id === id) {
        resetSelectedOcState();
      }
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.approval.approveError), "error");
    } finally {
      setApprovingId(null);
      setConfirmation(null);
    }
  }, [
    approveOc,
    approvingId,
    canApproveOc,
    confirmation,
    detailsLoading,
    recounting,
    resetSelectedOcState,
    selectedOC?.id,
    showToast
  ]);

  const handleSendToRecount = useCallback(async () => {
    if (!canRequestRecount || recounting || approvingId || detailsLoading || confirmation || recountModal) {
      return;
    }

    if (!selectedOC) {
      return;
    }

    if (itemsToRecount.length === 0) {
      showToast(feedbackMessages.approval.selectRecountItems, "info");
      return;
    }

    setRecountModal({
      ocId: selectedOC.id,
      itemIds: [...itemsToRecount]
    });

    setSelectedRecountEstoquistaId("");
    setLoadingEstoquistas(true);

    try {
      const data = await fetchEstoquistas({ nivel: 2 });
      setEstoquistas(asArray(data));
    } catch (error) {
      const message = getFeedbackErrorMessage(error, "Não foi possível carregar os estoquistas.");
      setEstoquistas([]);
      showToast(message, "error");
    } finally {
      setLoadingEstoquistas(false);
    }
  }, [
    canRequestRecount,
    approvingId,
    confirmation,
    detailsLoading,
    fetchEstoquistas,
    itemsToRecount,
    recountModal,
    recounting,
    selectedOC,
    showToast
  ]);

  const handleConfirmRecount = useCallback(async () => {
    const itemIds = recountModal?.itemIds || [];
    const ocId = recountModal?.ocId || null;
    const novoEstoquistaId = selectedRecountEstoquistaId ? Number(selectedRecountEstoquistaId) : null;

    if (!canRequestRecount || recounting || approvingId || detailsLoading || !ocId) {
      return;
    }

    if (!novoEstoquistaId) {
      showToast("Selecione o estoquista responsável pela recontagem.", "error");
      return;
    }

    const firstCountEstoquistaId = selectedOC?.primeira_contagem_estoquista_id || selectedOC?.estoquista_id;

    if (Number(novoEstoquistaId) === Number(firstCountEstoquistaId)) {
      showToast("Selecione um estoquista diferente do responsável pela primeira contagem.", "error");
      return;
    }

    setRecounting(true);

    try {
      await sendOcItemsToRecount(ocId, itemIds, novoEstoquistaId);
      showToast(feedbackMessages.approval.recountSuccess);
      resetSelectedOcState();
      await loadOCs({ showLoading: false });
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.approval.recountError), "error");
    } finally {
      setRecounting(false);
      setConfirmation(null);
    }
  }, [
    canRequestRecount,
    approvingId,
    detailsLoading,
    loadOCs,
    recountModal,
    recounting,
    resetSelectedOcState,
    selectedOC?.estoquista_id,
    selectedOC?.primeira_contagem_estoquista_id,
    selectedRecountEstoquistaId,
    sendOcItemsToRecount,
    showToast
  ]);

  const handleConfirmAction = useCallback(() => {
    if (confirmation?.type === "approve") {
      handleConfirmApprove();
      return;
    }

  }, [confirmation?.type, handleConfirmApprove]);

  const handleCancelRecountModal = useCallback(() => {
    if (recounting || loadingEstoquistas) {
      return;
    }

    setRecountModal(null);
    setSelectedRecountEstoquistaId("");
  }, [loadingEstoquistas, recounting]);

  const handleCloseDetails = useCallback(() => {
    if (recounting || recountModal) {
      return;
    }

    resetSelectedOcState();
  }, [recountModal, recounting, resetSelectedOcState]);

  const openLocationDetails = useCallback((item) => {
    if (!item) {
      return;
    }

    setDetailModal({
      title: `Localizações de ${formatProductName(item, "produto")}`,
      rows: buildApprovalLocationDetailRows(item)
    });
  }, []);

  const openLotDetails = useCallback((item) => {
    if (!item) {
      return;
    }

    setDetailModal({
      title: `Lotes de ${formatProductName(item, "produto")}`,
      rows: buildLocationLotDetailRows(item)
    });
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setDetailModal(null);
  }, []);

  if (!canApproveOc) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell aprovacao-page">
        <BackButton fallbackTo="/dashboard" />

        <PageHeader
          title="Aprovação"
          subtitle="Revise as ordens de contagem concluídas antes de encerrar o processo."
        />

        <ApprovalOcList
          loading={loading}
          error={approvalError}
          ocs={ocs}
          approvingId={approvingId}
          openingDetailsId={openingDetailsId}
          canApprove={canApproveOc}
          onOpenDetails={handleOpenDetails}
          onApprove={handleApprove}
        />

        <ApprovalDetailsPanel
          selectedOC={selectedOC}
          groupedItems={groupedSelectedItems}
          loading={detailsLoading}
          error={detailsError}
          recounting={recounting}
          approvingId={approvingId}
          openingDetailsId={openingDetailsId}
          canRequestRecount={canRequestRecount}
          isGroupMarkedForRecount={isGroupMarkedForRecount}
          onToggleRecountGroup={handleToggleRecountGroup}
          onOpenLocationDetails={openLocationDetails}
          onOpenLotDetails={openLotDetails}
          onClose={handleCloseDetails}
          onSendToRecount={handleSendToRecount}
        />

        <ApprovalDetailModal
          detailModal={detailModal}
          onClose={handleCloseDetailModal}
        />

        <ConfirmModal
          open={Boolean(confirmation?.type === "approve")}
          title="Aprovar OC"
          message={
            feedbackMessages.approval.confirmApprove
          }
          confirmLabel={
            approvingId ? "Aprovando..." : "Aprovar"
          }
          cancelLabel="Cancelar"
          variant="success"
          loading={Boolean(approvingId)}
          onCancel={handleCancelConfirmation}
          onConfirm={handleConfirmAction}
        />

        <RecountAssignmentModal
          open={Boolean(recountModal)}
          estoquistas={estoquistas}
          selectedEstoquistaId={selectedRecountEstoquistaId}
          currentEstoquistaId={selectedOC?.primeira_contagem_estoquista_id || selectedOC?.estoquista_id}
          oc={selectedOC}
          loadingEstoquistas={loadingEstoquistas}
          confirming={recounting}
          onChangeEstoquista={setSelectedRecountEstoquistaId}
          onCancel={handleCancelRecountModal}
          onConfirm={handleConfirmRecount}
        />
      </div>
    </Layout>
  );
}

export default Aprovacao;
