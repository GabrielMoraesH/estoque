import { ApiError, requestJson } from "./api";
import { produtosMock } from "./mockProdutos";
import {
  isSameProdutoName,
  normalizeProdutosResponse
} from "../contracts/produtosContract";

export {
  normalizeProduto,
  normalizeProdutosResponse,
  PRODUTO_LOCALIZACAO_FIELDS,
  PRODUTOS_INTEGRATION_BOUNDARY
} from "../contracts/produtosContract";

const DATA_SOURCE_MOCK = "mock";
const DATA_SOURCE_API = "api";
const DEFAULT_MOCK_DELAY_MS = 500;

const produtosDataSource = (
  process.env.REACT_APP_PRODUTOS_DATA_SOURCE || DATA_SOURCE_MOCK
).toLowerCase();

const produtosApiPath = process.env.REACT_APP_PRODUTOS_API_PATH;

function resolveEmpresaFilter({ empresaId, empresaCodigo } = {}) {
  return {
    empresaId: empresaId ? Number(empresaId) : null,
    empresaCodigo: empresaCodigo || ""
  };
}

function filterProdutosByEmpresa(produtos, empresaContext = {}) {
  const { empresaId, empresaCodigo } = resolveEmpresaFilter(empresaContext);

  if (!empresaId && !empresaCodigo) {
    return produtos;
  }

  return produtos.filter((produto) => {
    if (empresaId && Number(produto.empresa_id) === empresaId) {
      return true;
    }

    return Boolean(empresaCodigo) && produto.empresa_codigo === empresaCodigo;
  });
}

function getProdutosFromMock(options = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(normalizeProdutosResponse(filterProdutosByEmpresa(produtosMock, options)));
    }, DEFAULT_MOCK_DELAY_MS);
  });
}

async function getProdutosFromApi(options = {}) {
  // Ponto único para ligar a futura GET real de produtos/localizações.
  // As telas devem continuar consumindo useProdutos e receber dados normalizados.
  if (!produtosApiPath) {
    throw new ApiError("Endpoint de produtos não configurado para integração real.", {
      status: 0,
      path: "REACT_APP_PRODUTOS_API_PATH"
    });
  }

  const { empresaId } = resolveEmpresaFilter(options);
  const response = await requestJson(produtosApiPath, {
    headers: empresaId ? { "x-empresa-id": String(empresaId) } : undefined,
    authenticated: true
  });

  return normalizeProdutosResponse(response);
}

export function isUsingProdutosMock() {
  return produtosDataSource !== DATA_SOURCE_API;
}

export async function getProdutos(options = {}) {
  if (isUsingProdutosMock()) {
    return getProdutosFromMock(options);
  }

  return getProdutosFromApi(options);
}

export async function getProdutosExterno(options = {}) {
  return getProdutos(options);
}

export function getLocalizacoesPorProduto(produtos, nomeProduto) {
  if (!Array.isArray(produtos) || !nomeProduto) {
    return [];
  }

  return produtos.filter((produto) => isSameProdutoName(produto, nomeProduto));
}
