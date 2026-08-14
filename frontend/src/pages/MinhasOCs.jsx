import Layout from "../components/Layout";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import ConfirmModal from "../components/ui/ConfirmModal";
import MinhaOcCard from "../components/ocs/MinhaOcCard";
import { useToast } from "../components/ToastProvider";
import {
  feedbackMessages,
  getFeedbackErrorMessage
} from "../utils/feedbackMessages";
import { asArray, getRenderableList } from "../utils/ocData";
import "../styles/oc.css";
import "../styles/app-pages.css";

function MinhasOCs() {
  const { user } = useAuth();
  const { activeEmpresa } = useEmpresa();
  const { canFinalizeOc, canViewOwnOcs } = usePermissions();
  const { fetchEstoquistaOCs, finalizeOc } = useOCs();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [ocs, setOcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [finalizingId, setFinalizingId] = useState(null);
  const [ocToFinalize, setOcToFinalize] = useState(null);

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadOCs = async () => {
      setLoading(true);
      setLoadError("");
      setOcs([]);
      setFinalizingId(null);
      setOcToFinalize(null);

      try {
        const data = await fetchEstoquistaOCs({
          role: user?.role,
          id: user?.id
        });

        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        setOcs(asArray(data));
      } catch (error) {
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadListError);
        setOcs([]);
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (isCurrentRequest && empresaIdAtLoad === (activeEmpresa?.id || null)) {
          setLoading(false);
        }
      }
    };

    if (user?.id && canViewOwnOcs) {
      loadOCs();
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [activeEmpresa?.id, canViewOwnOcs, fetchEstoquistaOCs, showToast, user?.id, user?.role]);

  const handleOpenOc = useCallback((ocId) => {
    navigate(`/oc/${ocId}`, {
      state: {
        from: location.pathname
      }
    });
  }, [location.pathname, navigate]);

  const handleFinalizeOc = useCallback((oc) => {
    if (!oc?.id || finalizingId || ocToFinalize) {
      return;
    }

    setOcToFinalize(oc);
  }, [finalizingId, ocToFinalize]);

  const handleCancelFinalize = useCallback(() => {
    if (!finalizingId) {
      setOcToFinalize(null);
    }
  }, [finalizingId]);

  const handleConfirmFinalize = useCallback(async () => {
    const oc = ocToFinalize;

    if (!oc?.id || finalizingId) {
      return;
    }

    setFinalizingId(oc.id);

    try {
      await finalizeOc(oc.id);
      showToast(feedbackMessages.oc.finalizeSuccess);
      setOcs((current) => asArray(current).filter((currentOc) => currentOc?.id !== oc.id));
    } catch (error) {
      showToast(getFeedbackErrorMessage(error, feedbackMessages.oc.finalizeError), "error");
    } finally {
      setFinalizingId(null);
      setOcToFinalize(null);
    }
  }, [finalizeOc, finalizingId, ocToFinalize, showToast]);
  const safeOcs = getRenderableList(ocs);

  if (!canViewOwnOcs) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell">
        <BackButton fallbackTo="/dashboard" />

        <PageHeader
          title="Minhas OCs"
          subtitle="Acompanhe suas ordens de contagem e abra os detalhes de cada item."
        />

        <DataState
          loading={loading}
          error={loadError}
          empty={safeOcs.length === 0}
          loadingTitle="Carregando suas OCs"
          loadingMessage="Buscando as ordens abertas para contagem."
          errorTitle="Não foi possível carregar suas OCs"
          emptyTitle="Nenhuma OC disponível"
          emptyMessage="Quando uma ordem for atribuída a você, ela aparecerá aqui."
        >
          {safeOcs.map((oc) => (
            <MinhaOcCard
              key={oc.id}
              oc={oc}
              responsibleName={user?.nome}
              canFinalizeOc={canFinalizeOc}
              finalizingId={finalizingId}
              onOpenOc={handleOpenOc}
              onFinalizeOc={handleFinalizeOc}
            />
          ))}
        </DataState>

        <ConfirmModal
          open={Boolean(ocToFinalize)}
          title="Finalizar contagem"
          message={feedbackMessages.oc.confirmFinalize}
          confirmLabel={finalizingId ? "Finalizando..." : "Finalizar contagem"}
          cancelLabel="Cancelar"
          variant="primary"
          loading={Boolean(finalizingId)}
          onCancel={handleCancelFinalize}
          onConfirm={handleConfirmFinalize}
        />
      </div>
    </Layout>
  );
}

export default MinhasOCs;
