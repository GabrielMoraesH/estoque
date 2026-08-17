import { displayAuditValue, formatAuditDate, getSafeMetadataEntries, isSensitiveAuditKey } from "./audit";

describe("utilitários defensivos da auditoria", () => {
  it.each(["password", "Password", "PASSWORD", "password_hash", "passwordHash", "accessToken", "refresh_token", "Authorization", "clientSecret"])("identifica chave sensível %s", (key) => {
    expect(isSensitiveAuditKey(key)).toBe(true);
  });

  it("preserva nomes legítimos e remove credenciais históricas", () => {
    expect(isSensitiveAuditKey("token_count")).toBe(false);
    expect(getSafeMetadataEntries({ password: "x", token_count: 3, role: "admin" })).toEqual([["token_count", 3], ["role", "admin"]]);
    expect(displayAuditValue({ nested: { accessToken: "secret", role: "admin" } })).toBe('{"nested":{"role":"admin"}}');
  });

  it("fornece fallbacks para metadata e datas antigas", () => {
    expect(getSafeMetadataEntries(null)).toEqual([]);
    expect(displayAuditValue(undefined)).toBe("—");
    expect(displayAuditValue(Number.NaN)).toBe("—");
    expect(formatAuditDate("invalida")).toBe("Data não disponível");
  });
});
