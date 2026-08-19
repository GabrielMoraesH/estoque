import {
  asArray,
  attachLocationsToItems,
  buildApprovalHistoryDetailRows,
  buildApprovalLocationDetailRows,
  buildGestorLotDetailRows,
  buildOcItemsFromCart,
  buildLocationLotDetailRows,
  filterProdutosByName,
  formatSummaryDifference,
  getActionableOcItems,
  getApprovalReviewItems,
  getConsolidatedItemStatus,
  getCountingTrace,
  getCountingTraceFromHistory,
  getCountingTraceFromRecords,
  getOperationalOcStatus,
  getOperationalOcStatusLabel,
  getRenderableList,
  getSelectedItemIdSet,
  getTotalDifference,
  getUniqueProductNames,
  groupItemsForApproval,
  groupItemsForGestorDetails,
  groupProdutosByName,
  isOcReadyForApproval,
  summarizeOcItems,
  summarizeOcsByStatus,
  toNumber
} from "./ocData";
import { getLocalizacoesPorProduto } from "../services/produtosService";
import {
  buildOcItemPayloadFromProduto,
  getProdutoIdentity,
  normalizeProduto
} from "../contracts/produtosContract";

describe("selecao de produtos para Gerar OC", () => {
  const catalogo = [
    { id: 1, produto: "Dipirona", codigo: "10", endereco: "A1", saldo_sistema: 10 },
    { id: 2, produto: "Dipirona", codigo: "10", endereco: "A2", saldo_sistema: 20 },
    { id: 3, produto: "Dipirona", codigo: "11", endereco: "B1", saldo_sistema: 30 }
  ];

  it("mantem produtos homonimos separados pela identidade", () => {
    const agrupados = groupProdutosByName(catalogo);
    expect(agrupados).toHaveLength(2);
    expect(agrupados.map((produto) => produto.codigo)).toEqual(["10", "11"]);
    expect(agrupados.map((produto) => produto.saldo_sistema)).toEqual([30, 30]);
  });

  it("envia apenas as localizacoes do produto selecionado", () => {
    const [produtoCodigo10] = groupProdutosByName(catalogo);
    const items = buildOcItemsFromCart([produtoCodigo10], catalogo, getLocalizacoesPorProduto);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.endereco)).toEqual(["A1", "A2"]);
    expect(items.every((item) => item.codigo === "10")).toBe(true);
  });

  it("busca por descricao, codigo e codigo de barras com trim e sem diferenciar caixa", () => {
    const produtos = [{ produto: "Dipirona", codigo: "ABC-10", codigo_barras: "00123" }];
    expect(filterProdutosByName(produtos, " dipI ")).toHaveLength(1);
    expect(filterProdutosByName(produtos, " abc-10 ")).toHaveLength(1);
    expect(filterProdutosByName(produtos, " 00123 ")).toHaveLength(1);
    expect(filterProdutosByName(produtos, "   ")).toEqual(produtos);
  });

  it("prioriza ID externo, depois codigo, e usa nome apenas como fallback", () => {
    expect(getProdutoIdentity({ produto_externo_id: "10", codigo: "DIP", produto: "Dipirona" })).toBe("produto_externo_id:10");
    expect(getProdutoIdentity({ produto_externo_id: "11", codigo: "DIP2", produto: "Dipirona" })).toBe("produto_externo_id:11");
    expect(getProdutoIdentity({ codigo: "A1", produto: "Dipirona" })).toBe("codigo:A1");
    expect(getProdutoIdentity({ codigo: "A2", produto: "Dipirona" })).toBe("codigo:A2");
    expect(getProdutoIdentity({ produto: "Dipirona" })).toBe("produto_fallback:dipirona");
  });

  it("normaliza identificadores sem perder zero ou zeros a esquerda", () => {
    const casos = [[1, "1"], ["1", "1"], [0, "0"], ["0", "0"], ["00123", "00123"]];
    casos.forEach(([entrada, esperado]) => {
      expect(normalizeProduto({ produto_externo_id: entrada, localizacao_externa_id: entrada, codigo: entrada, codigo_barras: entrada })).toMatchObject({
        produto_externo_id: esperado,
        localizacao_externa_id: esperado,
        codigo: esperado,
        codigo_barras: esperado
      });
    });

    [null, undefined, ""].forEach((entrada) => {
      const payload = buildOcItemPayloadFromProduto({ produto: "Produto", endereco: "A1", codigo: entrada });
      expect(payload.codigo).toBeUndefined();
      expect(JSON.stringify(payload)).not.toMatch(/"(?:null|undefined)"/);
    });
  });

  it("remove localizacao duplicada do payload e preserva as demais", () => {
    const catalogoDuplicado = [
      { produto: "Produto A", codigo: "A", localizacao_externa_id: "1", endereco: "A1", saldo_sistema: 10 },
      { produto: "Produto A", codigo: "A", localizacao_externa_id: "1", endereco: "A1", saldo_sistema: 10 },
      { produto: "Produto A", codigo: "A", localizacao_externa_id: "2", endereco: "A2", saldo_sistema: 20 }
    ];
    const [produto] = groupProdutosByName(catalogoDuplicado);
    const items = buildOcItemsFromCart([produto], catalogoDuplicado, getLocalizacoesPorProduto);
    expect(items.map((item) => item.localizacao_externa_id)).toEqual(["1", "2"]);
  });

  it("preserva produto sem localizacao para rejeicao autoritativa do backend", () => {
    const catalogoSemLocalizacao = [{ produto: "Produto A", codigo: "A", saldo_sistema: 10 }];
    const [produto] = groupProdutosByName(catalogoSemLocalizacao);
    const items = buildOcItemsFromCart([produto], catalogoSemLocalizacao, getLocalizacoesPorProduto);

    expect(items).toHaveLength(1);
    expect(items[0].endereco).toBeUndefined();
  });
});

describe("normalização e fallbacks", () => {
  test.each([null, undefined, {}, "texto", 1])("normaliza entrada não-array %#", (value) => {
    expect(asArray(value)).toEqual([]);
    expect(getRenderableList(value)).toEqual([]);
  });

  it("remove valores vazios de listas renderizáveis", () => {
    expect(getRenderableList([null, false, { id: 1 }, undefined])).toEqual([{ id: 1 }]);
  });

  test.each([["12", 12], [0, 0], ["inválido", 0], [undefined, 7]])(
    "converte números com fallback",
    (value, expected) => expect(toNumber(value, value === undefined ? 7 : 0)).toBe(expected)
  );

  it("calcula diferença e formata o sinal com valores incompletos", () => {
    expect(getTotalDifference({ saldoSistema: "8", saldoContado: "10" })).toBe(2);
    expect(getTotalDifference(null)).toBe(0);
    expect(formatSummaryDifference({ saldoSistema: 10, saldoContado: 7 })).toBe("-3");
  });
});

describe("status e resumos", () => {
  test.each([
    [{ status: "finalizada", assignment_fase: "recontagem", assignment_status: "ativo" }, "finalizada"],
    [{ assignment_fase: "recontagem", assignment_status: "ativo" }, "em_recontagem"],
    [{ has_legacy_recount: true }, "em_recontagem"],
    [{ status: "recontar" }, "em_recontagem"],
    [{ status: "recontagem" }, "em_recontagem"],
    [{ status: "aguardando_aprovacao" }, "aguardando_aprovacao"],
    [{ status: "aberta" }, "em_contagem"],
    [null, "em_contagem"]
  ])("deriva status operacional %#", (oc, expected) => {
    expect(getOperationalOcStatus(oc)).toBe(expected);
    expect(getOperationalOcStatusLabel(oc)).toEqual(expect.any(String));
  });

  it("resume OCs pelo status operacional e ignora entradas vazias", () => {
    expect(summarizeOcsByStatus([
      null,
      { status: "aberta" },
      { status: "aguardando_aprovacao" },
      { status: "finalizada" },
      { status: "recontar" }
    ])).toEqual({ total: 4, emContagem: 1, aprovacao: 1, finalizadas: 1, recontagem: 1 });
    expect(summarizeOcsByStatus(undefined)).toEqual({ total: 0, emContagem: 0, aprovacao: 0, finalizadas: 0, recontagem: 0 });
  });

  it("resume itens e saldos com status padrão", () => {
    expect(summarizeOcItems([
      { status: "contado", saldo_sistema: "10", saldo_contado: "9" },
      { status: "aprovado", saldo_sistema: 5, saldo_contado: 5 },
      { status: "recontar", saldo_sistema: 2 },
      {},
      null
    ])).toEqual({ total: 4, contados: 1, aprovados: 1, recontagem: 1, pendentes: 1, saldoSistema: 17, saldoContado: 14 });
  });

  test.each([
    [["aprovado", "aprovado"], "aprovado"],
    [["aprovado", "recontar"], "recontagem"],
    [["contado", "pendente"], "pendente"],
    [["contado", "desconhecido"], "contado"],
    [[], "aprovado"],
    [["desconhecido"], "pendente"]
  ])("consolida status %#", (statuses, expected) => {
    expect(getConsolidatedItemStatus(statuses)).toBe(expected);
  });

  test.each([
    [{ qtd: 0, qtd_contados: 0 }, false],
    [{ qtd: 2, qtd_contados: 0 }, false],
    [{ qtd: "2", qtd_contados: 1 }, false],
    [{ qtd: "2", qtd_contados: 2 }, true]
  ])("deriva prontidão para aprovação", (oc, expected) => {
    expect(isOcReadyForApproval(oc)).toBe(expected);
  });
});

describe("seleção e listas de itens", () => {
  const items = [null, { id: 1, produto: "Dipirona", status: "pendente" }, { id: 2, produto: "Dipirona", status: "contado" }, { id: 3, produto: "Amoxicilina", status: "aprovado" }];

  it("seleciona identidades e nomes únicos válidos", () => {
    expect([...getSelectedItemIdSet([{ codigo: "DIP" }, null, { produto: "Amoxicilina" }])]).toEqual(["codigo:DIP", "produto_fallback:amoxicilina"]);
    expect(getUniqueProductNames(items)).toEqual(["Dipirona", "Amoxicilina"]);
  });

  it("separa itens acionáveis e revisáveis", () => {
    expect(getActionableOcItems(items).map((item) => item.id)).toEqual([1, 2]);
    expect(getApprovalReviewItems(items).map((item) => item.id)).toEqual([2, 3]);
    expect(getActionableOcItems(null)).toEqual([]);
  });

  it("ignora carrinho vazio e itens nulos", () => {
    expect(buildOcItemsFromCart(null, [], getLocalizacoesPorProduto)).toEqual([]);
    expect(buildOcItemsFromCart([null], [], getLocalizacoesPorProduto)).toEqual([]);
  });
});

describe("modelo atual e legado", () => {
  const locationsFor = (_catalog, produto) => [{ produto, endereco: "EXT-1", saldo_sistema: 10 }];

  it("preserva localizações snapshot do modelo atual", () => {
    const result = attachLocationsToItems([
      { id: 1, produto: "Dipirona", new_model: true, endereco: "SNAP-1", location: {} },
      { id: 2, produto: "Dipirona", oc_localizacao_id: 20, location: { endereco: "SNAP-2" } }
    ], [], "Dipirona", locationsFor);
    expect(result.map((item) => item.location.endereco)).toEqual(["SNAP-1", "SNAP-2"]);
  });

  it("anexa localizações externas ao modelo legado", () => {
    const result = attachLocationsToItems([{ id: 1, produto: "Dipirona" }], [], "Dipirona", locationsFor);
    expect(result[0].location.endereco).toBe("EXT-1");
    expect(attachLocationsToItems([], [], null, locationsFor)).toEqual([]);
  });

  it("agrupa aprovação atual por produto e usa saldos vigentes", () => {
    const grouped = groupItemsForApproval([{
      id: 1,
      oc_produto_id: 50,
      produto: "Dipirona",
      status: "contado",
      saldo_sistema_snapshot: 10,
      saldo_contado_vigente: 12,
      locations: [{ id: 100, endereco_snapshot: "A1", lote: "L1", saldo_contado: 12, contagens: [{ ciclo: 1, fase: "contagem", quantidade: 12, created_at: "2026-01-01T10:00:00Z" }] }]
    }], [], locationsFor);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ produto: "Dipirona", ocProdutoId: 50, saldoSistemaTotal: 10, saldoContadoTotal: 12, diferencaTotal: 2, itemIds: [50] });
    expect(grouped[0].locations[0]).toMatchObject({ itemId: 100, endereco: "A1", lote: "L1", saldoContado: 12 });
  });

  it("agrupa aprovação legada por nome e resolve localização externa", () => {
    const grouped = groupItemsForApproval([
      { id: 1, produto: "Dipirona", status: "contado", saldo_sistema: 10, saldo_contado: 9, lote: "L1" },
      { id: 2, produto: "Dipirona", status: "aprovado", saldo_sistema: 5, saldo_contado: 5, lote: "L2" }
    ], [], locationsFor);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ saldoSistemaTotal: 15, saldoContadoTotal: 14, diferencaTotal: -1, itemIds: [1, 2], status: "aprovado" });
    expect(grouped[0].locations[0]).toMatchObject({ endereco: "EXT-1", saldoSistema: 10, saldoContado: 9, diferenca: -1 });
  });

  it("agrupa detalhes do gestor e consolida produtos e localizações", () => {
    const grouped = groupItemsForGestorDetails([
      { id: 1, produto: "Dipirona", status: "contado", saldo_sistema: 10, saldo_contado: 8, lote: "L1" },
      { id: 2, produto: "Dipirona", status: "recontar", saldo_sistema: 5, saldo_contado: 5, lote: "L2" }
    ], [], locationsFor);
    expect(grouped[0]).toMatchObject({ produto: "Dipirona", saldoSistema: 15, saldoContado: 13, diferenca: -2, consolidatedStatus: "recontagem" });
    expect(grouped[0].details).toHaveLength(2);
    expect(groupItemsForGestorDetails(null, [], locationsFor)).toEqual([]);
  });
});

describe("contagens, ciclos e recontagem parcial", () => {
  const firstCount = { ciclo: 1, fase: "contagem", user_id: 1, usuario_nome: "Ana", created_at: "2026-01-01T10:00:00Z", quantidade: 10 };
  const recount = { ciclo: 2, fase: "recontagem", user_id: 2, usuario_nome: "Bia", created_at: "2026-01-02T10:00:00Z", quantidade: 11 };

  it("retorna rastro vazio e fallback do registro", () => {
    expect(getCountingTrace(null)).toEqual({ first: null, last: null, totalContagens: 0, hasCount: false, hasRecount: false });
    expect(getCountingTraceFromHistory([], { primeira_contagem_em: firstCount.created_at, total_contagens: 1 })).toMatchObject({ hasCount: true, hasRecount: false, totalContagens: 1 });
  });

  it("ordena histórico por ciclo e data e detecta recontagem", () => {
    const trace = getCountingTraceFromHistory([recount, firstCount]);
    expect(trace).toMatchObject({ totalContagens: 2, hasCount: true, hasRecount: true });
    expect(trace.first).toMatchObject({ userName: "Ana", date: firstCount.created_at });
    expect(trace.last).toMatchObject({ userName: "Bia", date: recount.created_at });
  });

  it("combina rastros e prioriza o intervalo que contém recontagem", () => {
    const trace = getCountingTraceFromRecords([
      { primeira_contagem_em: "2026-01-01T08:00:00Z", ultima_contagem_em: "2026-01-01T08:00:00Z", total_contagens: 1 },
      { primeira_contagem_em: "2026-01-01T10:00:00Z", ultima_contagem_em: "2026-01-02T10:00:00Z", total_contagens: 2, has_recount: true }
    ]);
    expect(trace).toMatchObject({ totalContagens: 3, hasCount: true, hasRecount: true });
    expect(trace.first.date).toBe("2026-01-01T10:00:00Z");
    expect(trace.last.date).toBe("2026-01-02T10:00:00Z");
    expect(getCountingTraceFromRecords([null])).toEqual(getCountingTrace(null));
  });

  it("preserva o resultado vigente de produto fora da recontagem parcial", () => {
    const dipirona = getCountingTraceFromHistory([firstCount, recount]);
    const amoxicilina = getCountingTraceFromHistory([{ ...firstCount, quantidade: 5 }]);
    expect(dipirona).toMatchObject({ totalContagens: 2, hasRecount: true, last: { userName: "Bia" } });
    expect(amoxicilina).toMatchObject({ totalContagens: 1, hasRecount: false, last: { userName: "Ana" } });
  });
});

describe("linhas de detalhe públicas", () => {
  const countingTrace = { hasCount: true };
  const item = { locations: [{ endereco: "A1", lote: "L1", saldoContado: 8, saldoSistema: 10, diferenca: -2, countingTrace }] };

  it("formata detalhes de localização, lote e gestor", () => {
    expect(buildApprovalLocationDetailRows(item)[0]).toMatchObject({ principal: "A1", countingTrace });
    expect(buildApprovalLocationDetailRows(item)[0].secondary).toContain("-2");
    expect(buildLocationLotDetailRows(item)[0]).toMatchObject({ principal: "Lote: L1", countingTrace });
    expect(buildGestorLotDetailRows({ details: item.locations })[0]).toMatchObject({ principal: "Lote: L1", countingTrace });
  });

  it("ordena e formata histórico de aprovação", () => {
    const rows = buildApprovalHistoryDetailRows({ locations: [{ endereco: "A1", history: [
      { id: 2, ciclo: 2, fase: "recontagem", quantidade: 11, created_at: "2026-01-02T10:00:00Z" },
      { id: 1, ciclo: 1, fase: "contagem", quantidade: 10, created_at: "2026-01-01T10:00:00Z", usuario_nome: "Ana" }
    ] }] });
    expect(rows).toHaveLength(2);
    expect(rows[0].principal).toContain("Ciclo 1");
    expect(rows[0].secondary).toContain("Ana");
    expect(rows[1].principal).toContain("Ciclo 2");
  });

  test.each([buildApprovalHistoryDetailRows, buildApprovalLocationDetailRows, buildLocationLotDetailRows])(
    "retorna lista vazia para detalhe incompleto",
    (builder) => expect(builder(null)).toEqual([])
  );
});
