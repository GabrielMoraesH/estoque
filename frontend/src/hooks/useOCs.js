import { useCallback } from "react";
import {
  approveOC,
  createOCWithItems,
  finalizarOC,
  getEstoquistas,
  getItemsByOC,
  getOCsByEstoquista,
  getOCsByGestor,
  getOCsForApproval,
  salvarContagem,
  sendItemsToRecount
} from "../services/api";
import useEmpresa from "./useEmpresa";

export function useOCs() {
  const { activeEmpresa } = useEmpresa();
  const activeEmpresaId = activeEmpresa?.id || null;

  const createOcWithProducts = useCallback((data) => {
    void activeEmpresaId;
    return createOCWithItems(data);
  }, [activeEmpresaId]);
  const fetchGestorOCs = useCallback((params) => {
    void activeEmpresaId;
    return getOCsByGestor(params);
  }, [activeEmpresaId]);
  const fetchEstoquistaOCs = useCallback((params) => {
    void activeEmpresaId;
    return getOCsByEstoquista(params);
  }, [activeEmpresaId]);
  const fetchEstoquistas = useCallback(() => {
    void activeEmpresaId;
    return getEstoquistas();
  }, [activeEmpresaId]);
  const fetchApprovalOCs = useCallback((params) => {
    void activeEmpresaId;
    return getOCsForApproval(params);
  }, [activeEmpresaId]);
  const fetchOcItems = useCallback((ocId) => {
    void activeEmpresaId;
    return getItemsByOC(ocId);
  }, [activeEmpresaId]);
  const saveItemCount = useCallback((data) => {
    void activeEmpresaId;
    return salvarContagem(data);
  }, [activeEmpresaId]);
  const finalizeOc = useCallback((id) => {
    void activeEmpresaId;
    return finalizarOC(id);
  }, [activeEmpresaId]);
  const approveOc = useCallback((id) => {
    void activeEmpresaId;
    return approveOC(id);
  }, [activeEmpresaId]);
  const sendOcItemsToRecount = useCallback(
    (id, itemIds, novoEstoquistaId) => {
      void activeEmpresaId;
      return sendItemsToRecount(id, itemIds, novoEstoquistaId);
    },
    [activeEmpresaId]
  );

  return {
    createOcWithProducts,
    fetchGestorOCs,
    fetchEstoquistaOCs,
    fetchEstoquistas,
    fetchApprovalOCs,
    fetchOcItems,
    saveItemCount,
    finalizeOc,
    approveOc,
    sendOcItemsToRecount
  };
}

export default useOCs;
