import {
  buildOcItemsFromCart,
  filterProdutosByName,
  groupProdutosByName
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
