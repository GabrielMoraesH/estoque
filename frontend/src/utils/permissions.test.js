import {
  ROLES,
  canApproveOc,
  canCountOc,
  canCreateOc,
  canFinalizeOc,
  canManageEmpresas,
  canManageUsers,
  canRequestRecount,
  canViewAudit,
  canViewCountingItem,
  canViewGestorOcs,
  canViewOwnOcs,
  hasAnyRole,
  hasRole,
  isAdmin,
  isEstoquista,
  isGestor
} from "./permissions";

const permissionMatrix = [
  ["administrador", { role: ROLES.ADMIN }, [true, true, true, true, true, true, false, false, false]],
  ["gestor", { role: ROLES.GESTOR }, [false, false, false, true, true, true, false, false, false]],
  ["estoquista", { role: ROLES.ESTOQUISTA }, [false, false, false, false, false, false, true, true, true]]
];

const permissions = [
  canManageUsers,
  canManageEmpresas,
  canViewAudit,
  canCreateOc,
  canViewGestorOcs,
  canApproveOc,
  canViewOwnOcs,
  canCountOc,
  canFinalizeOc
];

describe("permissions", () => {
  test.each(permissionMatrix)("aplica a matriz de permissões para %s", (_label, user, expected) => {
    expect(permissions.map((permission) => permission(user))).toEqual(expected);
  });

  test.each([
    [canRequestRecount, ROLES.ADMIN, true],
    [canRequestRecount, ROLES.GESTOR, true],
    [canRequestRecount, ROLES.ESTOQUISTA, false],
    [canViewCountingItem, ROLES.ADMIN, false],
    [canViewCountingItem, ROLES.GESTOR, false],
    [canViewCountingItem, ROLES.ESTOQUISTA, true]
  ])("valida permissões derivadas", (permission, role, expected) => {
    expect(permission({ role })).toBe(expected);
  });

  test.each([
    [isAdmin, ROLES.ADMIN],
    [isGestor, ROLES.GESTOR],
    [isEstoquista, ROLES.ESTOQUISTA]
  ])("reconhece somente a role exata", (predicate, role) => {
    expect(predicate({ role })).toBe(true);
    expect(predicate({ role: `${role}-invalida` })).toBe(false);
  });

  test.each([null, undefined, {}, { role: "" }, { role: "desconhecida" }, { nivel: 2 }])(
    "nega todas as permissões para entrada inválida %#",
    (user) => {
      expect(permissions.map((permission) => permission(user))).toEqual(permissions.map(() => false));
      expect(canRequestRecount(user)).toBe(false);
      expect(canViewCountingItem(user)).toBe(false);
    }
  );

  it("expõe verificações genéricas de role com fallback seguro", () => {
    expect(hasRole({ role: ROLES.GESTOR }, ROLES.GESTOR)).toBe(true);
    expect(hasRole(null, ROLES.GESTOR)).toBe(false);
    expect(hasAnyRole({ role: ROLES.GESTOR }, [ROLES.ADMIN, ROLES.GESTOR])).toBe(true);
    expect(hasAnyRole({}, [ROLES.ADMIN, ROLES.GESTOR])).toBe(false);
  });
});
