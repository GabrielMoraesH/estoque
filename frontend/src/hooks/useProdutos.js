import { useCallback } from "react";
import {
  getLocalizacoesPorProduto as selectLocalizacoesPorProduto,
  getProdutos,
  isUsingProdutosMock
} from "../services/produtosService";
import useEmpresa from "./useEmpresa";

export function useProdutos() {
  const { activeEmpresa } = useEmpresa();
  const empresaId = activeEmpresa?.id || null;
  const empresaCodigo = activeEmpresa?.codigo || "";

  const fetchProdutos = useCallback(
    () => getProdutos({ empresaId, empresaCodigo }),
    [empresaCodigo, empresaId]
  );
  const getLocalizacoesPorProduto = useCallback(
    (produtos, nomeProduto) => selectLocalizacoesPorProduto(produtos, nomeProduto),
    []
  );

  return {
    fetchProdutos,
    getLocalizacoesPorProduto,
    isUsingMock: isUsingProdutosMock()
  };
}

export default useProdutos;
