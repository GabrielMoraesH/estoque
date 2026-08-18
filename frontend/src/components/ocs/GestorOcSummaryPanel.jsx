import Panel from "../ui/Panel";
import { formatDateTime, formatResponsibleName } from "../../utils/formatters";
import { formatSummaryDifference, getOperationalOcStatus, getOperationalOcStatusLabel } from "../../utils/ocData";
import OcEmpresaBadge from "./OcEmpresaBadge";
import StatusPill, { getStatusPillVariant } from "../ui/StatusPill";

function GestorOcSummaryPanel({ oc, summary, assignmentAction }) {
  const safeSummary = summary || {};
  const status = getOperationalOcStatus(oc);
  const statusVariant = getStatusPillVariant(status);

  return (
    <>
      <div className="gestor-overview-grid gestor-oc-summary-grid">
        <Panel className="gestor-overview-card gestor-summary-card">
          <span className="gestor-overview-label">Status atual</span>
          <StatusPill variant={statusVariant}>{getOperationalOcStatusLabel(oc)}</StatusPill>
        </Panel>
        <Panel className="gestor-overview-card gestor-summary-card">
          <span className="gestor-overview-label">Empresa</span>
          <OcEmpresaBadge oc={oc} className="empresa-badge-block" />
        </Panel>
        <Panel className="gestor-overview-card gestor-summary-card">
          <span className="gestor-overview-label">Responsável operacional</span>
          <strong className="gestor-overview-responsible">{formatResponsibleName(oc?.estoquista_nome)}</strong>
        </Panel>
        <Panel className="gestor-overview-card gestor-summary-card">
          <span className="gestor-overview-label">Produtos</span>
          <strong>{oc?.qtd ?? safeSummary.total}</strong>
        </Panel>
        <Panel className="gestor-overview-card gestor-summary-card">
          <span className="gestor-overview-label">Diferença total</span>
          <strong>{formatSummaryDifference(safeSummary)}</strong>
        </Panel>
      </div>

      <Panel
        className="gestor-details-card"
        title="Resumo da OC"
        subtitle="Consulte rapidamente o andamento da ordem antes de seguir para outra tela."
        headerClassName="gestor-detail-topbar"
      >
        <div className="oc-detail-company-row">
          <span>Empresa</span>
          <OcEmpresaBadge oc={oc} />
        </div>

        <div className="gestor-oc-meta-grid">
          <div className="gestor-oc-meta">
            <span>Criado por</span>
            <strong>{formatResponsibleName(oc?.criador_nome, "-")}</strong>
          </div>
          <div className="gestor-oc-meta">
            <span>Progresso</span>
            <strong>{oc?.status === "finalizada" ? "Concluída" : `${oc?.localizacoes_contadas ?? 0} / ${oc?.total_localizacoes ?? 0} localizações`}</strong>
          </div>
          <div className="gestor-oc-meta">
            <span>Última movimentação</span>
            <strong>{formatDateTime(oc?.ultima_movimentacao_em || oc?.updated_at || oc?.created_at)}</strong>
          </div>
          <div className="gestor-oc-meta">
            <span>Pendentes</span>
            <strong>{safeSummary.pendentes}</strong>
          </div>
          <div className="gestor-oc-meta">
            <span>Contados</span>
            <strong>{safeSummary.contados}</strong>
          </div>
          <div className="gestor-oc-meta">
            <span>Aprovados</span>
            <strong>{safeSummary.aprovados}</strong>
          </div>
          <div className="gestor-oc-meta">
            <span>Recontagem</span>
            <strong>{safeSummary.recontagem}</strong>
          </div>
        </div>
      </Panel>
      {assignmentAction}
    </>
  );
}

export default GestorOcSummaryPanel;
