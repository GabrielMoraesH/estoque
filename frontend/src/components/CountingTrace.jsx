import { memo } from "react";
import { formatDateTime, formatResponsibleName } from "../utils/formatters";

function CountLine({ label, count }) {
  if (!count) {
    return null;
  }

  return (
    <span className="counting-trace-line">
      <strong>{label}:</strong>{" "}
      {formatResponsibleName(count.userName)} — {formatDateTime(count.date)}
    </span>
  );
}

function CountingTrace({ trace, compact = false }) {
  if (!trace?.hasCount) {
    return (
      <div className="counting-trace counting-trace-empty">
        Sem registro de contagem
      </div>
    );
  }

  if (!trace.hasRecount) {
    return (
      <div className={`counting-trace${compact ? " counting-trace-compact" : ""}`}>
        <CountLine label="Contado por" count={trace.last || trace.first} />
      </div>
    );
  }

  return (
    <div className={`counting-trace counting-trace-recount${compact ? " counting-trace-compact" : ""}`}>
      <CountLine label="Primeira contagem" count={trace.first} />
      <CountLine label="Recontagem" count={trace.last} />
    </div>
  );
}

export default memo(CountingTrace);
