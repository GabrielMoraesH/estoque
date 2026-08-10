import Panel from "../ui/Panel";

function GestorOverviewStats({ stats }) {
  const safeStats = stats || {};

  return (
    <div className="gestor-overview-grid">
      <Panel className="gestor-overview-card">
        <span className="gestor-overview-label">OCs criadas</span>
        <strong>{safeStats.total}</strong>
      </Panel>
      <Panel className="gestor-overview-card">
        <span className="gestor-overview-label">Em aberto</span>
        <strong>{safeStats.abertas}</strong>
      </Panel>
      <Panel className="gestor-overview-card">
        <span className="gestor-overview-label">Em aprovação</span>
        <strong>{safeStats.aprovacao}</strong>
      </Panel>
      <Panel className="gestor-overview-card">
        <span className="gestor-overview-label">Finalizadas</span>
        <strong>{safeStats.finalizadas}</strong>
      </Panel>
    </div>
  );
}

export default GestorOverviewStats;
