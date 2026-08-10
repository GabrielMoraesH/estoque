import {
  buildOcItemPayloadFromProduto,
  findProdutoLocationForOcItem
} from "../contracts/produtosContract";
import {
  formatLocationBalanceSummary,
  formatLocationName,
  formatLot,
  formatProductName,
  formatSignedNumber
} from "./formatters";

const DEFAULT_OC_STATS = {
  total: 0,
  abertas: 0,
  aprovacao: 0,
  finalizadas: 0,
  recontagem: 0
};

const DEFAULT_ITEM_SUMMARY = {
  total: 0,
  contados: 0,
  aprovados: 0,
  recontagem: 0,
  pendentes: 0,
  saldoSistema: 0,
  saldoContado: 0
};

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getRenderableList(value) {
  return asArray(value).filter(Boolean);
}

export function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasRealRecount(record, first, last, totalContagens) {
  if (totalContagens <= 1) {
    return false;
  }

  return Boolean(record?.has_recount === true || (first && last));
}

export function getCountingTrace(record) {
  const first = record?.primeira_contagem_em
    ? {
        userId: record?.primeira_contagem_user_id || null,
        userName: record?.primeira_contagem_usuario_nome || null,
        date: record?.primeira_contagem_em
      }
    : null;
  const last = record?.ultima_contagem_em
    ? {
        userId: record?.ultima_contagem_user_id || null,
        userName: record?.ultima_contagem_usuario_nome || null,
        date: record?.ultima_contagem_em
      }
    : null;
  const totalContagens = toNumber(record?.total_contagens);

  return {
    first,
    last,
    totalContagens,
    hasCount: Boolean(first || last),
    hasRecount: hasRealRecount(record, first, last, totalContagens)
  };
}

export function getCountingTraceFromRecords(records) {
  const traces = getRenderableList(records)
    .map(getCountingTrace)
    .filter((trace) => trace.hasCount);

  if (traces.length === 0) {
    return getCountingTrace(null);
  }

  const recountTraces = traces.filter((trace) => trace.hasRecount);
  const sourceTraces = recountTraces.length > 0 ? recountTraces : traces;
  const first = sourceTraces
    .map((trace) => trace.first)
    .filter(Boolean)
    .sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date))[0] || null;
  const last = sourceTraces
    .map((trace) => trace.last)
    .filter(Boolean)
    .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date))[0] || null;
  const totalContagens = traces.reduce((sum, trace) => sum + toNumber(trace.totalContagens), 0);
  const hasRecount = recountTraces.length > 0;

  return {
    first,
    last,
    totalContagens,
    hasCount: Boolean(first || last),
    hasRecount
  };
}

export function getCountingTraceFromHistory(history, fallbackRecord) {
  const records = asArray(history);

  if (records.length === 0) {
    return getCountingTrace(fallbackRecord);
  }

  const sorted = records
    .filter(Boolean)
    .sort((a, b) => {
      const cycleDiff = toNumber(a?.ciclo) - toNumber(b?.ciclo);
      if (cycleDiff !== 0) {
        return cycleDiff;
      }

      return toTimestamp(a?.created_at) - toTimestamp(b?.created_at);
    });
  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || null;

  return {
    first: first
      ? {
          userId: first.user_id || null,
          userName: first.usuario_nome || null,
          date: first.created_at || null
        }
      : null,
    last: last
      ? {
          userId: last.user_id || null,
          userName: last.usuario_nome || null,
          date: last.created_at || null
        }
      : null,
    totalContagens: sorted.length,
    hasCount: sorted.length > 0,
    hasRecount: sorted.some((record) => toNumber(record?.ciclo) > 1 || record?.fase === "recontagem")
  };
}

export function getTotalDifference(summary) {
  return toNumber(summary?.saldoContado) - toNumber(summary?.saldoSistema);
}

export function isOcReadyForApproval(oc) {
  return toNumber(oc?.qtd) > 0 && toNumber(oc?.qtd_contados) === toNumber(oc?.qtd);
}

export function getSelectedItemIdSet(items) {
  return new Set(getRenderableList(items).map((item) => item.id));
}

export function groupProdutosByName(produtos) {
  return asArray(produtos).reduce((acc, produto) => {
    if (!produto) {
      return acc;
    }

    const nomeProduto = formatProductName(produto);
    const existing = acc.find((item) => item.produto === nomeProduto);

    if (existing) {
      existing.saldo_sistema += toNumber(produto.saldo_sistema);
      return acc;
    }

    acc.push({
      id: nomeProduto,
      produto: nomeProduto,
      saldo_sistema: toNumber(produto.saldo_sistema),
      ultima_contagem: produto.ultima_contagem
    });

    return acc;
  }, []);
}

export function filterProdutosByName(produtos, searchTerm) {
  const normalizedTerm = String(searchTerm || "").toLowerCase().trim();

  if (!normalizedTerm) {
    return asArray(produtos);
  }

  return asArray(produtos).filter((produto) =>
    String(produto?.produto || "").toLowerCase().includes(normalizedTerm)
  );
}

export function buildOcItemsFromCart(cart, produtos, getLocalizacoesPorProduto) {
  return asArray(cart).flatMap((item) =>
    item
      ? getLocalizacoesPorProduto(produtos, item.produto).map(buildOcItemPayloadFromProduto)
      : []
  );
}

export function getActionableOcItems(items) {
  return asArray(items).filter((item) => item && item.status !== "aprovado");
}

export function getApprovalReviewItems(items) {
  return asArray(items).filter(
    (item) => item && (item.status === "contado" || item.status === "aprovado")
  );
}

export function getUniqueProductNames(items) {
  return Array.from(
    new Set(getRenderableList(items).map((item) => item?.produto).filter(Boolean))
  );
}

export function attachLocationsToItems(items, produtosExterno, produto, getLocalizacoesPorProduto) {
  if (!produto) {
    return [];
  }

  const productItems = asArray(items).filter((item) => item?.produto === produto);
  const hasSnapshotLocations = productItems.some((item) => item?.new_model || item?.oc_localizacao_id);

  if (hasSnapshotLocations) {
    return productItems.map((item) => ({
      ...item,
      location: {
        ...(item?.location || {}),
        endereco: item?.location?.endereco || item?.endereco
      }
    }));
  }

  const productLocations = getLocalizacoesPorProduto(produtosExterno, produto);

  return productItems.map((item, index) => ({
    ...item,
    location: findProdutoLocationForOcItem(item, productLocations, index)
  }));
}

export function summarizeOcsByStatus(ocs) {
  return asArray(ocs).reduce((acc, oc) => {
    if (!oc) {
      return acc;
    }

    const status = (oc.status || "aberta").toLowerCase();
    acc.total += 1;

    if (status === "aberta") acc.abertas += 1;
    if (status === "aguardando_aprovacao") acc.aprovacao += 1;
    if (status === "finalizada") acc.finalizadas += 1;
    if (status === "recontar") acc.recontagem += 1;

    return acc;
  }, { ...DEFAULT_OC_STATS });
}

export function summarizeOcItems(items) {
  return asArray(items).reduce((acc, item) => {
    if (!item) {
      return acc;
    }

    const status = (item.status || "pendente").toLowerCase();
    acc.total += 1;

    if (status === "contado") acc.contados += 1;
    if (status === "aprovado") acc.aprovados += 1;
    if (status === "recontar") acc.recontagem += 1;
    if (status === "pendente") acc.pendentes += 1;

    acc.saldoSistema += toNumber(item.saldo_sistema);
    acc.saldoContado += toNumber(item.saldo_contado);
    return acc;
  }, { ...DEFAULT_ITEM_SUMMARY });
}

export function groupItemsForApproval(items, produtosExterno, getLocalizacoesPorProduto) {
  const groups = asArray(items).reduce((acc, item) => {
    if (!item) {
      return acc;
    }

    const produto = formatProductName(item);
    const externalLocations = getLocalizacoesPorProduto(produtosExterno, produto);
    const itemId = item?.oc_produto_id || item?.id;
    const snapshotLocations = asArray(item?.locations || item?.localizacoes);

    if (!acc[produto]) {
      acc[produto] = {
        produto,
        saldoSistemaTotal: 0,
        saldoContadoTotal: 0,
        diferencaTotal: 0,
        status: item.status,
        itemIds: [],
        countingRecords: [],
        locations: []
      };
    }

    const group = acc[produto];
    const matchedLocation = findProdutoLocationForOcItem(
      item,
      externalLocations,
      group.locations.length
    );
    const saldoSistema = toNumber(item.saldo_sistema_snapshot ?? item.saldo_sistema);
    const saldoContado = toNumber(item.saldo_contado_vigente ?? item.saldo_contado);

    group.saldoSistemaTotal += saldoSistema;
    group.saldoContadoTotal += saldoContado;
    group.itemIds.push(itemId);
    group.countingRecords.push(item);
    group.status =
      group.status === "contado" && item.status === "contado"
        ? "contado"
        : item.status;
    if (snapshotLocations.length > 0) {
      snapshotLocations.forEach((location) => {
        group.locations.push({
          itemId: location?.id || itemId,
          endereco: formatLocationName(location?.endereco || location?.endereco_snapshot),
          lote: formatLot(location?.lote),
          saldoContado: toNumber(location?.saldo_contado),
          countingTrace: getCountingTraceFromHistory(location?.contagens, item)
        });
      });
    } else {
      group.locations.push({
        itemId,
        endereco: formatLocationName(matchedLocation?.endereco),
        lote: formatLot(item.lote),
        saldoContado,
        saldoSistema,
        diferenca: saldoContado - saldoSistema,
        countingTrace: getCountingTrace(item)
      });
    }

    return acc;
  }, {});

  return Object.values(groups).map((group) => ({
    ...group,
    countingTrace: getCountingTraceFromRecords(group.countingRecords),
    diferencaTotal: group.saldoContadoTotal - group.saldoSistemaTotal
  }));
}

export function getConsolidatedItemStatus(statuses) {
  if (statuses.every((status) => status === "aprovado")) return "aprovado";
  if (statuses.includes("recontar")) return "recontagem";
  if (statuses.includes("pendente")) return "pendente";
  if (statuses.includes("contado")) return "contado";

  return "pendente";
}

export function groupItemsForGestorDetails(items, produtosExterno, getLocalizacoesPorProduto) {
  const groups = asArray(items).reduce((acc, item) => {
    if (!item) {
      return acc;
    }

    const produto = formatProductName(item);
    const externalLocations = getLocalizacoesPorProduto(produtosExterno, produto);

    if (!acc[produto]) {
      acc[produto] = {
        produto,
        saldoSistema: 0,
        saldoContado: 0,
        diferenca: 0,
        details: [],
        countingRecords: [],
        statuses: []
      };
    }

    const group = acc[produto];
    const matchedLocation = findProdutoLocationForOcItem(
      item,
      externalLocations,
      group.details.length
    );
    const saldoSistema = toNumber(item.saldo_sistema);
    const saldoContado = toNumber(item.saldo_contado);

    group.saldoSistema += saldoSistema;
    group.saldoContado += saldoContado;
    group.diferenca = group.saldoContado - group.saldoSistema;
    group.countingRecords.push(item);
    group.details.push({
      lote: formatLot(item.lote),
      endereco: formatLocationName(matchedLocation?.endereco),
      countingTrace: getCountingTrace(item)
    });
    group.statuses.push(item.status || "pendente");

    return acc;
  }, {});

  return Object.values(groups).map((group) => ({
    ...group,
    countingTrace: getCountingTraceFromRecords(group.countingRecords),
    consolidatedStatus: getConsolidatedItemStatus(group.statuses)
  }));
}

export function buildApprovalLocationDetailRows(item) {
  return getRenderableList(item?.locations).map((location) => ({
    principal: formatLocationName(location?.endereco),
    secondary: formatLocationBalanceSummary(location),
    countingTrace: location?.countingTrace
  }));
}

export function buildLocationLotDetailRows(item) {
  return getRenderableList(item?.locations).map((location) => ({
    principal: `Lote: ${formatLot(location?.lote)}`,
    secondary: `Localização: ${formatLocationName(location?.endereco)}`,
    countingTrace: location?.countingTrace
  }));
}

export function buildGestorLotDetailRows(item) {
  return getRenderableList(item?.details).map((detail) => ({
    principal: `Lote: ${formatLot(detail?.lote)}`,
    secondary: `Localização: ${formatLocationName(detail?.endereco)}`,
    countingTrace: detail?.countingTrace
  }));
}

export function formatSummaryDifference(summary) {
  return formatSignedNumber(getTotalDifference(summary));
}
