export const ROLES = {
  ADMIN: "admin",
  GESTOR: "gestor",
  ESTOQUISTA: "estoquista"
};

const getUserRole = (user) => user?.role || "";

export function hasRole(user, role) {
  return getUserRole(user) === role;
}

export function hasAnyRole(user, roles) {
  return roles.includes(getUserRole(user));
}

export function isAdmin(user) {
  return hasRole(user, ROLES.ADMIN);
}

export function isGestor(user) {
  return hasRole(user, ROLES.GESTOR);
}

export function isEstoquista(user) {
  return hasRole(user, ROLES.ESTOQUISTA);
}

export function canManageUsers(user) {
  return isAdmin(user);
}

export function canCreateOc(user) {
  return hasAnyRole(user, [ROLES.ADMIN, ROLES.GESTOR]);
}

export function canViewGestorOcs(user) {
  return hasAnyRole(user, [ROLES.ADMIN, ROLES.GESTOR]);
}

export function canApproveOc(user) {
  return hasAnyRole(user, [ROLES.ADMIN, ROLES.GESTOR]);
}

export function canRequestRecount(user) {
  return canApproveOc(user);
}

export function canViewOwnOcs(user) {
  return isEstoquista(user);
}

export function canCountOc(user) {
  return isEstoquista(user);
}

export function canFinalizeOc(user) {
  return canCountOc(user);
}

export function canViewCountingItem(user) {
  return canCountOc(user);
}
