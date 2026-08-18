export function getStatusPillVariant(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "finalizada" || normalizedStatus === "aprovado") return "success";
  if (normalizedStatus === "aguardando_aprovacao") return "warning";
  if (normalizedStatus.includes("recont")) return "recount";
  if (normalizedStatus === "em_contagem" || normalizedStatus === "contado") return "info";

  return "neutral";
}

function StatusPill({ variant = "neutral", className = "", children }) {
  return <span className={`status-pill status-pill-${variant}${className ? ` ${className}` : ""}`}>{children}</span>;
}

export default StatusPill;
