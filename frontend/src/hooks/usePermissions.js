import { useMemo } from "react";
import useAuth from "./useAuth";
import {
  canApproveOc,
  canCountOc,
  canCreateOc,
  canFinalizeOc,
  canManageUsers,
  canManageEmpresas,
  canRequestRecount,
  canViewCountingItem,
  canViewGestorOcs,
  canViewOwnOcs,
  isAdmin,
  isEstoquista,
  isGestor
} from "../utils/permissions";

export function usePermissions() {
  const { user } = useAuth();

  return useMemo(() => ({
    isAdmin: isAdmin(user),
    isGestor: isGestor(user),
    isEstoquista: isEstoquista(user),
    canManageUsers: canManageUsers(user),
    canManageEmpresas: canManageEmpresas(user),
    canCreateOc: canCreateOc(user),
    canApproveOc: canApproveOc(user),
    canRequestRecount: canRequestRecount(user),
    canViewGestorOcs: canViewGestorOcs(user),
    canViewOwnOcs: canViewOwnOcs(user),
    canCountOc: canCountOc(user),
    canFinalizeOc: canFinalizeOc(user),
    canViewCountingItem: canViewCountingItem(user)
  }), [user]);
}

export default usePermissions;
