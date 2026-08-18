import Panel from "../ui/Panel";

function GestorOverviewStats({ stats }) {
  const safeStats = stats || {};

  return (
    <div className="gestor-overview-grid">
      <Panel className="metric-card gestor-overview-card">
        <span className="gestor-overview-label">Total de OCs</span>
        <strong>{safeStats.total}</strong>
      </Panel>
      <Panel className="metric-card gestor-overview-card">
        <span className="gestor-overview-label">Em contagem</span>
        <strong>{safeStats.emContagem}</strong>
      </Panel>
      <Panel className="metric-card gestor-overview-card">
        <span className="gestor-overview-label">Em recontagem</span>
        <strong>{safeStats.recontagem}</strong>
      </Panel>
      <Panel className="metric-card gestor-overview-card">
        <span className="gestor-overview-label">Em aprovação</span>
        <strong>{safeStats.aprovacao}</strong>
      </Panel>
      <Panel className="metric-card gestor-overview-card">
        <span className="gestor-overview-label">Finalizadas</span>
        <strong>{safeStats.finalizadas}</strong>
      </Panel>
    </div>
  );
}

export default GestorOverviewStats;
