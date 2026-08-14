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
import { asArray, getOperationalOcStatus, getRenderableList, summarizeOcsByStatus } from "../utils/ocData";
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
  const [loadedEmpresaId, setLoadedEmpresaId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");

  useEffect(() => {
    const empresaIdAtLoad = activeEmpresa?.id || null;
    let isCurrentRequest = true;

    const loadOCs = async () => {
      setLoading(true);
      setLoadError("");
      setOcs([]);
      setLoadedEmpresaId(null);

      try {
        const data = await fetchGestorOCs({
          role: user?.role,
          id: user?.id
        });
        
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        setOcs(asArray(data));
        setLoadedEmpresaId(empresaIdAtLoad);
      } catch (error) {
        if (!isCurrentRequest || empresaIdAtLoad !== (activeEmpresa?.id || null)) {
          return;
        }

        const message = getFeedbackErrorMessage(error, feedbackMessages.oc.loadGestorListError);
        setOcs([]);
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
      loadOCs();
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [activeEmpresa?.id, canViewGestorOcs, fetchGestorOCs, showToast, user?.id, user?.role]);

  const isCurrentEmpresaLoaded = loadedEmpresaId === (activeEmpresa?.id || null);
  const effectiveLoading = loading || !isCurrentEmpresaLoaded;
  const safeOcs = useMemo(
    () => (isCurrentEmpresaLoaded ? getRenderableList(ocs) : []),
    [isCurrentEmpresaLoaded, ocs]
  );
  const stats = useMemo(() => summarizeOcsByStatus(safeOcs), [safeOcs]);
  const filteredOcs = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return safeOcs.filter((oc) => {
      const matchesStatus = statusFilter === "todas" || getOperationalOcStatus(oc) === statusFilter;
      const searchable = [oc.id, oc.codigo, oc.criador_nome, oc.estoquista_nome]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [safeOcs, search, statusFilter]);

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

        {!effectiveLoading && !loadError ? <GestorOverviewStats stats={stats} /> : null}

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

        <div className="gestor-filters" role="search" aria-label="Filtrar ordens de contagem">
          <label>
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="OC, criador ou responsável"
            />
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="todas">Todas</option>
              <option value="em_contagem">Em contagem</option>
              <option value="aguardando_aprovacao">Aguardando aprovação</option>
              <option value="em_recontagem">Em recontagem</option>
              <option value="finalizada">Finalizadas</option>
            </select>
          </label>
        </div>

        <DataState
          loading={effectiveLoading}
          error={loadError}
          empty={filteredOcs.length === 0}
          loadingTitle="Carregando OCs"
          loadingMessage="Buscando as ordens criadas e suas últimas movimentações."
          errorTitle="Não foi possível carregar as OCs"
          emptyTitle={safeOcs.length === 0 ? "Nenhuma OC encontrada" : "Nenhum resultado encontrado"}
          emptyMessage={safeOcs.length === 0
            ? "Quando uma ordem de contagem for criada, ela aparecerá nesta lista."
            : "Ajuste a busca ou o filtro de status para ver outras OCs."}
        >
          {filteredOcs.map((oc) => (
            <GestorOcCard key={oc.id} oc={oc} onOpenOc={handleOpenOc} />
          ))}
        </DataState>
      </div>
    </Layout>
  );
}

export default Gestor;
