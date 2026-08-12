export const PRODUTO_LOCALIZACAO_FIELDS = Object.freeze([
  "id",
  "produto_externo_id",
  "localizacao_externa_id",
  "produto",
  "saldo_sistema",
  "endereco",
  "codigo",
  "codigo_barras",
  "validade",
  "ultima_contagem",
  "empresa_id",
  "empresa_codigo"
]);

export const PRODUTOS_INTEGRATION_BOUNDARY = Object.freeze({
  currentSource: "mockProdutos",
  serviceLayer: "services/produtosService.js",
  hookLayer: "hooks/useProdutos.js",
  futureApiEnvPath: "REACT_APP_PRODUTOS_API_PATH"
});

function parseNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function optionalText(...values) {
  const resolvedValue = firstValue(...values);
  return resolvedValue === undefined ? undefined : String(resolvedValue).trim();
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveProdutoNome(rawProduto) {
  return firstValue(rawProduto.produto, rawProduto.nome, rawProduto.nome_produto, "");
}

function resolveEndereco(rawProduto) {
  const localizedKey = "localiza\u00e7\u00e3o";

  return firstValue(
    rawProduto.endereco,
    rawProduto.localizacao,
    rawProduto["localizacao"],
    rawProduto[localizedKey],
    ""
  );
}

export function normalizeProduto(rawProduto, index = 0) {
  const produto = rawProduto || {};

  return {
    id: firstValue(produto.id, produto.codigo_barras, produto.codigo, index + 1),
    produto_externo_id: optionalText(produto.produto_externo_id, produto.produtoId, produto.produto_id),
    localizacao_externa_id: optionalText(
      produto.localizacao_externa_id,
      produto.localizacaoId,
      produto.localizacao_id,
      produto.id,
      ""
    ),
    produto: resolveProdutoNome(produto),
    saldo_sistema: parseNumber(
      firstValue(produto.saldo_sistema, produto.saldoSistema, produto.saldo)
    ),
    endereco: resolveEndereco(produto),
    codigo: optionalText(produto.codigo),
    codigo_barras: optionalText(
      produto.codigo_barras,
      produto.codigoBarras,
      produto.barcode,
      produto.ean,
      ""
    ),
    validade: firstValue(produto.validade, ""),
    ultima_contagem: firstValue(produto.ultima_contagem, produto.ultimaContagem, ""),
    empresa_id: firstValue(produto.empresa_id, produto.empresaId, null),
    empresa_codigo: firstValue(produto.empresa_codigo, produto.empresaCodigo, "")
  };
}

export function normalizeProdutosResponse(response) {
  const produtos = Array.isArray(response)
    ? response
    : response?.produtos || response?.items || response?.data || [];

  return Array.isArray(produtos)
    ? produtos.map((produto, index) => normalizeProduto(produto, index))
    : [];
}

export function buildOcItemPayloadFromProduto(produto) {
  const normalizedProduto = normalizeProduto(produto);

  return {
    produto_externo_id: normalizedProduto.produto_externo_id,
    produto: normalizedProduto.produto,
    saldo_sistema: normalizedProduto.saldo_sistema,
    localizacao_externa_id: normalizedProduto.localizacao_externa_id,
    endereco: normalizedProduto.endereco,
    codigo: normalizedProduto.codigo,
    codigo_barras: normalizedProduto.codigo_barras,
    validade: normalizedProduto.validade
  };
}

export function isSameProdutoName(produto, nomeProduto) {
  return normalizeText(produto?.produto) === normalizeText(nomeProduto);
}

export function findProdutoLocationForOcItem(item, productLocations, fallbackIndex = 0) {
  if (item?.endereco) {
    return normalizeProduto(item);
  }

  const locations = Array.isArray(productLocations) ? productLocations : [];

  const exactMatch = locations.find((location) => {
    if (item?.codigo_barras && location.codigo_barras === item.codigo_barras) {
      return true;
    }

    if (item?.codigo && item?.endereco) {
      return location.codigo === item.codigo && location.endereco === item.endereco;
    }

    return false;
  });

  return exactMatch || locations[fallbackIndex] || null;
}
