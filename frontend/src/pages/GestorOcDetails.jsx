import Layout from "../components/Layout";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import GestorOcSummaryPanel from "../components/ocs/GestorOcSummaryPanel";
import OcHistoryTrace from "../components/ocs/OcHistoryTrace";
import useAuth from "../hooks/useAuth";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import useOCs from "../hooks/useOCs";
import { useToast } from "../components/ToastProvider";
import { feedbackMessages, getFeedbackErrorMessage } from "../utils/feedbackMessages";
import { formatOcCode } from "../utils/formatters";
import { asArray, summarizeOcItems } from "../utils/ocData";
import "../styles/app-pages.css";
import "../styles/aprovacao.css";
import "../styles/oc.css";

function GestorOcDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { activeEmpresa } = useEmpresa();
  const { canViewGestorOcs } = usePermissions();
  const { fetchOcHistory } = useOCs();
  const { showToast } = useToast();
  const [oc, setOc] = useState(null);
  const [history, setHistory] = useState(null);
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
      setHistory(null);
      setLoadedEmpresaId(null);

      try {
        const historyData = await fetchOcHistory(id);

        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        if (!historyData?.oc) {
          setOc(null);
          setHistory(null);
          setLoadedEmpresaId(empresaIdAtLoad);
          return;
        }
        setOc(historyData.oc);
        setHistory(historyData);
        setLoadedEmpresaId(empresaIdAtLoad);
      } catch (error) {
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadDetailsError);
        setOc(null);
        setHistory(null);
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
    fetchOcHistory,
    id,
    showToast,
    user?.id,
    user?.role
  ]);

  const summary = summarizeOcItems(asArray(history?.produtos));
  const isCurrentEmpresaLoaded = loadedEmpresaId === (activeEmpresa?.id || null);
  const effectiveLoading = loading || !isCurrentEmpresaLoaded;

  if (!canViewGestorOcs) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <BackButton fallbackTo="/gestor" />

        <PageHeader
          title={`OC ${formatOcCode(id)}`}
          subtitle="Histórico somente leitura da trajetória operacional desta ordem."
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

              <OcHistoryTrace history={history} />
            </>
          ) : null}
        </DataState>
      </div>

    </Layout>
  );
}

export default GestorOcDetails;
