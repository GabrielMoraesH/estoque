export function formatOcCode(id) {
  return String(id).padStart(4, "0");
}

function toDisplayNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function formatQuantity(value, fallback = 0) {
  return String(toDisplayNumber(value, fallback));
}

export function formatBalance(value, fallback = 0) {
  return formatQuantity(value, fallback);
}

export function formatSignedNumber(value) {
  const numericValue = toDisplayNumber(value, 0);

  if (numericValue > 0) {
    return `+${numericValue}`;
  }

  if (numericValue < 0) {
    return String(numericValue);
  }

  return "0";
}

export function formatFallbackText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function formatProductName(value, fallback = "Produto sem nome") {
  const productName = typeof value === "object" && value !== null ? value.produto : value;
  return formatFallbackText(productName, fallback);
}

export function formatResponsibleName(value, fallback = "Não informado") {
  return formatFallbackText(value, fallback);
}

export function formatLocationName(value, fallback = "Não informada") {
  return formatFallbackText(value, fallback);
}

export function formatLot(value, fallback = "-") {
  return formatFallbackText(value, fallback);
}

export function formatLastCount(value, fallback = "Sem registro") {
  return formatFallbackText(value, fallback);
}

export function formatCountProgress(counted, total) {
  return `${formatQuantity(counted)} de ${formatQuantity(total)}`;
}

export function formatDateTime(value, fallback = "Não informado") {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString("pt-BR");
}

export function formatRelativeTime(value, fallback = "Ainda não houve contagem") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  const diffInMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));

  if (diffInMinutes < 60) {
    return `Há ${diffInMinutes} min`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInHours < 24) {
    return `Há ${diffInHours} h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `Há ${diffInDays} dia${diffInDays > 1 ? "s" : ""}`;
}

export function normalizeStatus(status, fallback = "aberta") {
  return String(status || fallback).toLowerCase();
}

export function getOcStatusLabel(status, { uppercase = false, fallbackStatus = "aberta" } = {}) {
  const labels = {
    aguardando_aprovacao: "Aguardando aprovação",
    finalizada: "Finalizada",
    recontagem: "Recontagem",
    recontar: "Recontagem",
    aprovado: "Aprovado",
    contado: "Contado",
    pendente: "Pendente",
    aberta: "Aberta"
  };

  const normalizedStatus = normalizeStatus(status, fallbackStatus);
  const label = labels[normalizedStatus] || labels[fallbackStatus] || labels.aberta;
  return uppercase ? label.toUpperCase() : label;
}

export function getItemStatusLabel(status, options = {}) {
  return getOcStatusLabel(status, { fallbackStatus: "pendente", ...options });
}

export function getStatusClassName(status, prefix = "status", fallback = "aberta") {
  return `${prefix}-${normalizeStatus(status, fallback)}`;
}

export function formatLocationBalanceSummary(location) {
  const parts = [`Saldo contado: ${formatBalance(location?.saldoContado)}`];

  if (location && Object.prototype.hasOwnProperty.call(location, "saldoSistema")) {
    parts.push(`Saldo sistema: ${formatBalance(location.saldoSistema)}`);
  }

  if (location && Object.prototype.hasOwnProperty.call(location, "diferenca")) {
    parts.push(`Diferenca: ${formatSignedNumber(location.diferenca)}`);
  }

  return parts.join(" | ");
}

export function formatUserRoleLabel(role, fallback = "Não informado") {
  const labels = {
    admin: "Administrador",
    gestor: "Gestor",
    estoquista: "Estoquista"
  };

  return labels[String(role || "").toLowerCase()] || fallback;
}

export function getOcResponsibleLabel(status) {
  switch ((status || "").toLowerCase()) {
    case "aguardando_aprovacao":
    case "finalizada":
      return "Contada por";
    case "recontar":
      return "Recontagem com";
    case "aberta":
    default:
      return "Responsável";
  }
}
