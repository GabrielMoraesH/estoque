import Layout from "../components/Layout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import { useToast } from "../components/ToastProvider";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import SectionHeader from "../components/ui/SectionHeader";
import GestorOcCard from "../components/ocs/GestorOcCard";
import GestorOverviewStats from "../components/ocs/GestorOverviewStats";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import { asArray, getRenderableList, summarizeOcsByStatus } from "../utils/ocData";
import "../styles/oc.css";
import "../styles/app-pages.css";

function Gestor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeEmpresa } = useEmpresa();
  const { canCreateOc, canViewGestorOcs } = usePermissions();
  const { fetchGestorOCs } = useOCs();
  const { showToast } = useToast();
  const [ocs, setOcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadOCs = async () => {
      setLoading(true);
      setLoadError("");
      setOcs([]);

      try {
        const data = await fetchGestorOCs({
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

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadGestorListError);
        setOcs([]);
        setLoadError(message);
        showToast(message, "error");
      } finally {
        if (isCurrentRequest && empresaIdAtLoad === (activeEmpresa?.id || null)) {
          setLoading(false);
        }
      }
    };

    if (user?.id && canViewGestorOcs) {
      loadOCs();
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [activeEmpresa?.id, canViewGestorOcs, fetchGestorOCs, showToast, user?.id, user?.role]);

  const stats = useMemo(() => summarizeOcsByStatus(ocs), [ocs]);
  const safeOcs = getRenderableList(ocs);

  const handleGoToGerarOc = useCallback(() => {
    navigate("/gerar-oc", {
      state: {
        from: location.pathname
      }
    });
  }, [location.pathname, navigate]);

  const handleOpenOc = useCallback((ocId) => {
    navigate(`/gestor/oc/${ocId}`, {
      state: {
        from: location.pathname
      }
    });
  }, [location.pathname, navigate]);

  if (!canViewGestorOcs) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <BackButton fallbackTo="/dashboard" />

        <PageHeader
          title="Gestão de OCs"
          subtitle="Acompanhe as ordens criadas, veja o andamento da contagem e abra os detalhes de cada OC."
        />

        <GestorOverviewStats stats={stats} />

        <Panel
          className="toolbar-card gestor-toolbar-card"
          title="Central do gestor"
          subtitle="Crie novas OCs e acompanhe abaixo tudo o que já foi distribuído para contagem."
          actions={canCreateOc && (
            <button
              className="primary-button"
              type="button"
              onClick={handleGoToGerarOc}
            >
              Gerar OC
            </button>
          )}
        />

        <SectionHeader
          className="page-header"
          title="OCs em acompanhamento"
          subtitle="Cada card mostra o status atual, o responsável pela contagem e a última movimentação."
        />

        <DataState
          loading={loading}
          error={loadError}
          empty={safeOcs.length === 0}
          loadingTitle="Carregando OCs"
          loadingMessage="Buscando as ordens criadas e suas últimas movimentações."
          errorTitle="Não foi possível carregar as OCs"
          emptyTitle="Nenhuma OC encontrada"
          emptyMessage="Quando uma ordem de contagem for criada, ela aparecerá nesta lista."
        >
          {safeOcs.map((oc) => (
            <GestorOcCard key={oc.id} oc={oc} onOpenOc={handleOpenOc} />
          ))}
        </DataState>
      </div>
    </Layout>
  );
}

export default Gestor;
