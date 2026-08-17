const SENSITIVE_KEYS = new Set([
  "password", "password_hash", "password_old", "password_new",
  "senha", "senha_hash", "senha_antiga", "senha_nova", "hash",
  "token", "access_token", "refresh_token", "jwt", "authorization",
  "cookie", "secret", "client_secret"
]);

export function normalizeAuditKey(key) {
  return String(key).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase();
}

export function isSensitiveAuditKey(key) {
  return SENSITIVE_KEYS.has(normalizeAuditKey(key));
}

export function getSafeMetadataEntries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).filter(([key]) => !isSensitiveAuditKey(key)).slice(0, 100);
}

function sanitizeHistoricalValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (depth >= 5) return "[conteúdo limitado]";
  if (seen.has(value)) return "[conteúdo circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeHistoricalValue(item, depth + 1, seen));
  return Object.entries(value).filter(([key]) => !isSensitiveAuditKey(key)).slice(0, 100).reduce((safe, [key, item]) => {
    safe[key] = sanitizeHistoricalValue(item, depth + 1, seen);
    return safe;
  }, {});
}

export function displayAuditValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && !Number.isFinite(value)) return "—";
  if (typeof value === "object") {
    try { return JSON.stringify(sanitizeHistoricalValue(value)); } catch { return "[conteúdo não disponível]"; }
  }
  return String(value);
}

export function formatAuditDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não disponível" : date.toLocaleString("pt-BR");
}
