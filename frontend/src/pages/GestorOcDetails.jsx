import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import FormField from "../components/ui/FormField";
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
  const { fetchOcHistory, fetchEstoquistas, reassignAssignment } = useOCs();
  const { showToast } = useToast();
  const [oc, setOc] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadedEmpresaId, setLoadedEmpresaId] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reassignError, setReassignError] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const submitLockRef = useRef(false);
  const activeEmpresaIdRef = useRef(activeEmpresa?.id || null);
  const reassignRequestIdRef = useRef(0);

  useEffect(() => {
    activeEmpresaIdRef.current = activeEmpresa?.id || null;
    reassignRequestIdRef.current += 1;
    submitLockRef.current = false;
    setReassignOpen(false);
    setReassigning(false);
  }, [activeEmpresa?.id]);

  useEffect(() => () => {
    reassignRequestIdRef.current += 1;
    submitLockRef.current = false;
  }, []);

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
  const activeAssignment = asArray(history?.ciclos).find((assignment) => assignment.status === "ativo") || null;
  const isCurrentEmpresaLoaded = loadedEmpresaId === (activeEmpresa?.id || null);
  const effectiveLoading = loading || !isCurrentEmpresaLoaded;

  const openReassignment = async () => {
    if (!activeAssignment) return;
    const requestId = ++reassignRequestIdRef.current;
    const empresaIdAtRequest = activeEmpresaIdRef.current;
    setReassignOpen(true);
    setReassignError("");
    setSelectedUserId(String(activeAssignment.estoquista_id));
    try {
      const users = await fetchEstoquistas({ nivel: activeAssignment.fase === "recontagem" ? 2 : 1 });
      if (requestId !== reassignRequestIdRef.current || empresaIdAtRequest !== activeEmpresaIdRef.current) return;
      setEligibleUsers(asArray(users).filter((candidate) => candidate.ativo !== false));
    } catch (error) {
      if (requestId !== reassignRequestIdRef.current || empresaIdAtRequest !== activeEmpresaIdRef.current) return;
      setReassignError(getFeedbackErrorMessage(error, "Não foi possível carregar os responsáveis elegíveis."));
    }
  };

  const submitReassignment = async () => {
    if (!activeAssignment || !selectedUserId || submitLockRef.current) return;
    submitLockRef.current = true;
    const requestId = ++reassignRequestIdRef.current;
    setReassigning(true);
    setReassignError("");
    const empresaIdAtSubmit = activeEmpresa?.id || null;
    try {
      await reassignAssignment(id, activeAssignment.id, Number(selectedUserId));
      if (requestId !== reassignRequestIdRef.current || empresaIdAtSubmit !== activeEmpresaIdRef.current) return;
      const refreshed = await fetchOcHistory(id);
      if (requestId !== reassignRequestIdRef.current || empresaIdAtSubmit !== activeEmpresaIdRef.current) return;
      setOc(refreshed.oc);
      setHistory(refreshed);
      setReassignOpen(false);
      showToast("Responsável reatribuído com sucesso.", "success");
    } catch (error) {
      if (requestId === reassignRequestIdRef.current && empresaIdAtSubmit === activeEmpresaIdRef.current) {
        setReassignError(getFeedbackErrorMessage(error, "Não foi possível reatribuir o responsável."));
      }
    } finally {
      if (requestId === reassignRequestIdRef.current) {
        submitLockRef.current = false;
        if (empresaIdAtSubmit === activeEmpresaIdRef.current) setReassigning(false);
      }
    }
  };

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
                assignmentAction={activeAssignment ? (
                  <section className="reassign-panel" aria-labelledby="reassign-title">
                    <div>
                      <h2 id="reassign-title">Responsável do assignment ativo</h2>
                      <p>Ciclo {activeAssignment.ciclo} · {activeAssignment.fase} · {oc?.localizacoes_contadas ?? 0}/{oc?.total_localizacoes ?? 0}</p>
                    </div>
                    {!reassignOpen ? (
                      <Button onClick={openReassignment}>Reatribuir responsável</Button>
                    ) : (
                      <div className="reassign-form">
                        <FormField label="Novo responsável elegível" htmlFor="reassign-user">
                          <select className="field-control" id="reassign-user" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} disabled={reassigning}>
                            <option value="">Selecione</option>
                            {eligibleUsers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nome}</option>)}
                          </select>
                        </FormField>
                        {reassignError ? <p className="form-error" role="alert">{reassignError}</p> : null}
                        <div className="reassign-actions">
                          <Button variant="secondary" onClick={() => { reassignRequestIdRef.current += 1; submitLockRef.current = false; setReassignOpen(false); setReassigning(false); }} disabled={reassigning}>Cancelar</Button>
                          <Button onClick={submitReassignment} disabled={reassigning || !selectedUserId}>{reassigning ? "Reatribuindo…" : "Confirmar reatribuição"}</Button>
                        </div>
                      </div>
                    )}
                  </section>
                ) : null}
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
