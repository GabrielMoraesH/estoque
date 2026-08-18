import Layout from "../components/Layout";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataState from "../components/ui/DataState";
import PageHeader from "../components/ui/PageHeader";
import Panel from "../components/ui/Panel";
import Button from "../components/ui/Button";
import StatusPill, { getStatusPillVariant } from "../components/ui/StatusPill";
import useEmpresa from "../hooks/useEmpresa";
import usePermissions from "../hooks/usePermissions";
import { getDashboardSummary } from "../services/api";
import {
  formatCountProgress,
  formatOcCode,
  formatRelativeTime,
  getOcStatusLabel
} from "../utils/formatters";
import "../styles/app-pages.css";

const ADMIN_SHORTCUTS = [
  { label: "Usuários", to: "/users" },
  { label: "Gerar OC", to: "/gerar-oc" },
  { label: "Gestão de OCs", to: "/gestor" },
  { label: "Aprovação", to: "/aprovacao" }
];

const GESTOR_SHORTCUTS = [
  { label: "Gerar OC", to: "/gerar-oc" },
  { label: "Gestão de OCs", to: "/gestor" },
  { label: "Aprovação", to: "/aprovacao" }
];

const ESTOQUISTA_SHORTCUTS = [
  { label: "Minhas OCs", to: "/minhas-ocs" }
];

function IndicatorGrid({ items }) {
  return (
    <div className="dashboard-indicator-grid">
      {items.map((item) => (
        <Panel className="metric-card dashboard-indicator-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.helper && <small>{item.helper}</small>}
        </Panel>
      ))}
    </div>
  );
}

function QuickAccess({ shortcuts }) {
  const navigate = useNavigate();

  return (
    <Panel title="Acesso rápido">
      <div className="dashboard-shortcuts">
        {shortcuts.map((shortcut) => (
          <Button
            key={shortcut.to}
            onClick={() => navigate(shortcut.to)}
          >
            {shortcut.label}
          </Button>
        ))}
      </div>
    </Panel>
  );
}

function AdminAttention({ tasks, empty }) {
  const navigate = useNavigate();

  return (
    <Panel
      title="Atenção necessária"
      subtitle="OCs que já podem receber decisão operacional."
    >
      <DataState
        empty={empty}
        emptyTitle="Tudo certo por aqui"
        emptyMessage="Nenhuma OC aguardando sua atenção."
        panel={false}
        compact
      >
        <div className="dashboard-task-list">
          {tasks.map((task) => (
            <article className="dashboard-task-card dashboard-attention-task-card" key={task.id}>
              <div className="dashboard-attention-task-content">
                <div className="dashboard-attention-task-header">
                  <p className="dashboard-task-code">OC {formatOcCode(task.id)}</p>
                  <Button
                    variant="secondary"
                    onClick={() => navigate(task.action_to || "/aprovacao")}
                  >
                    Abrir
                  </Button>
                </div>
                <StatusPill variant={getStatusPillVariant(task.status)}>
                  {getOcStatusLabel(task.status)}
                </StatusPill>
              </div>

              <dl className="dashboard-task-meta">
                <div>
                  <dt>Filial</dt>
                  <dd>{task.empresa_nome || "Filial ativa"}</dd>
                </div>
                <div>
                  <dt>Produtos</dt>
                  <dd>{task.quantidade_produtos}</dd>
                </div>
                <div>
                  <dt>Responsável</dt>
                  <dd>{task.responsavel_nome || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Última movimentação</dt>
                  <dd>{formatRelativeTime(task.ultima_movimentacao_em, "Sem movimentação")}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </DataState>
    </Panel>
  );
}

function EstoquistaTasks({ tasks, empty }) {
  const navigate = useNavigate();

  return (
    <Panel
      title="Minhas próximas OCs"
      subtitle="Tarefas atribuídas a você nesta filial."
    >
      <DataState
        empty={empty}
        emptyTitle="Sem OCs pendentes"
        emptyMessage="Você não possui OCs pendentes nesta filial."
        panel={false}
        compact
      >
        <div className="dashboard-task-list">
          {tasks.map((task) => (
            <article className="dashboard-task-card" key={task.id}>
              <div className="dashboard-task-main">
                <div>
                  <p className="dashboard-task-code">OC {formatOcCode(task.id)}</p>
                  <StatusPill variant={getStatusPillVariant(task.status)}>
                    {getOcStatusLabel(task.status)}
                  </StatusPill>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => navigate(task.action_to || `/oc/${task.id}`)}
                >
                  Abrir OC
                </Button>
              </div>

              <div className="dashboard-progress">
                <div>
                  <span>Progresso de localizações</span>
                  <strong>
                    {formatCountProgress(task.localizacoes_contadas, task.total_localizacoes)}
                  </strong>
                </div>
                <div className="dashboard-progress-track" aria-hidden="true">
                  <span style={{ width: `${task.progresso_percentual || 0}%` }} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </DataState>
    </Panel>
  );
}

function Dashboard() {
  const { activeEmpresa } = useEmpresa();
  const { isAdmin, isGestor, isEstoquista } = usePermissions();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      setSummary(null);

      try {
        const result = await getDashboardSummary();
        if (!cancelled) {
          setSummary(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Não foi possível carregar o Dashboard. Tente novamente em instantes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [activeEmpresa?.id]);

  const shortcuts = useMemo(() => {
    if (isAdmin) return ADMIN_SHORTCUTS;
    if (isGestor) return GESTOR_SHORTCUTS;
    if (isEstoquista) return ESTOQUISTA_SHORTCUTS;
    return [];
  }, [isAdmin, isGestor, isEstoquista]);

  const isAdministrative = summary?.tipo === "administrativo";
  const isOperational = summary?.tipo === "estoquista";
  const adminIndicators = summary?.indicadores || {};
  const stockIndicators = summary?.indicadores || {};

  return (
    <Layout>
      <div className="page-shell stack-lg">
        <PageHeader
          level={1}
          title="Dashboard"
          subtitle={activeEmpresa?.nome || "Filial ativa não definida"}
        />

        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && !summary}
          loadingTitle="Carregando Dashboard"
          loadingMessage="Buscando os indicadores da filial ativa."
          errorTitle="Dashboard indisponível"
          emptyTitle="Sem dados para exibir"
          emptyMessage="Nenhuma informação foi encontrada para esta filial."
        >
          {isAdministrative && (
            <>
              {(adminIndicators.total_ocs || 0) === 0 ? (
                <Panel title="Visão operacional">
                  <DataState
                    empty
                    emptyTitle="Nenhuma OC encontrada nesta filial"
                    emptyMessage="Assim que uma OC for gerada para a filial ativa, os indicadores aparecerão aqui."
                    panel={false}
                    compact
                  />
                </Panel>
              ) : (
                <>
                  <IndicatorGrid
                    items={[
                      { label: "Total de OCs", value: adminIndicators.total_ocs || 0 },
                      { label: "Em contagem", value: adminIndicators.em_contagem || 0 },
                      { label: "Aguardando aprovação", value: adminIndicators.aguardando_aprovacao || 0 },
                      { label: "Em recontagem", value: adminIndicators.em_recontagem || 0 },
                      { label: "Finalizadas", value: adminIndicators.finalizadas || 0 },
                      { label: "Atenção necessária", value: adminIndicators.atencao_necessaria || 0 }
                    ]}
                  />

                  <AdminAttention
                    tasks={summary.atencao_necessaria || []}
                    empty={(summary.atencao_necessaria || []).length === 0}
                  />
                </>
              )}
            </>
          )}

          {isOperational && (
            <>
              <IndicatorGrid
                items={[
                  { label: "OCs atribuídas", value: stockIndicators.ocs_atribuidas || 0 },
                  { label: "OCs em andamento", value: stockIndicators.ocs_em_andamento || 0 },
                  { label: "Prontas para finalizar", value: stockIndicators.prontas_para_finalizar || 0 }
                ]}
              />

              <EstoquistaTasks
                tasks={summary.proximas_ocs || []}
                empty={(summary.proximas_ocs || []).length === 0}
              />
            </>
          )}

          <QuickAccess shortcuts={shortcuts} />
        </DataState>
      </div>
    </Layout>
  );
}

export default Dashboard;
