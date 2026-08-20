import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import GerarOC from "./GerarOC";
import usePermissions from "../hooks/usePermissions";
import useEmpresa from "../hooks/useEmpresa";
import useOCs from "../hooks/useOCs";
import useProdutos from "../hooks/useProdutos";

jest.mock("../components/Layout", () => ({ children }) => <main>{children}</main>);
jest.mock("../components/BackButton", () => () => null);
jest.mock("../components/ToastProvider", () => ({ useToast: jest.fn() }));
jest.mock("../hooks/usePermissions", () => jest.fn());
jest.mock("../hooks/useEmpresa", () => jest.fn());
jest.mock("../hooks/useOCs", () => jest.fn());
jest.mock("../hooks/useProdutos", () => jest.fn());
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <output data-testid="redirect">{to}</output>,
  useLocation: () => ({ pathname: "/gerar-oc", state: null }),
  useNavigate: jest.fn()
}), { virtual: true });

const { useToast } = require("../components/ToastProvider");
const { useNavigate } = require("react-router-dom");

const catalogo = [
  {
    produto_externo_id: "dipirona-500",
    localizacao_externa_id: "a1",
    produto: "Dipirona 500mg",
    codigo: "DIP-500",
    codigo_barras: "789100000001",
    saldo_sistema: 12,
    endereco: "A-01",
    validade: "2027-01-01"
  },
  {
    produto_externo_id: "amoxicilina-500",
    localizacao_externa_id: "b2",
    produto: "Amoxicilina 500mg",
    codigo: "AMO-500",
    codigo_barras: "789100000002",
    saldo_sistema: 8,
    endereco: "B-02",
    validade: "2027-02-01"
  }
];
const produtos = [catalogo[0]];

const estoquistas = [
  { id: 21, nome: "Ana Estoquista", role: "estoquista", ativo: true, nivel_estoquista: 1, empresas: [{ id: 10 }] },
  { id: 22, nome: "Bruno Outro", role: "estoquista", ativo: true, nivel_estoquista: 2, empresas: [{ id: 10 }] },
  { id: 23, nome: "Carla Outra Empresa", role: "estoquista", ativo: true, nivel_estoquista: 1, empresas: [{ id: 11 }] }
];

function renderPage() {
  return render(<GerarOC />);
}

async function waitForLoad() {
  await screen.findByText("Dipirona 500mg");
  await screen.findByRole("option", { name: "Ana Estoquista" });
}

async function addDipironaAndSelectEstoquista(user) {
  await waitForLoad();
  await user.click(screen.getByRole("button", { name: "Adicionar" }));
  await user.selectOptions(screen.getByLabelText("Estoquista respons\u00e1vel"), "21");
}

describe("GerarOC", () => {
  let showToast;
  let createOcWithProducts;
  let fetchProdutos;
  let fetchEstoquistas;
  let getLocalizacoesPorProduto;
  let navigate;

  beforeEach(() => {
    jest.clearAllMocks();
    showToast = jest.fn();
    createOcWithProducts = jest.fn();
    fetchProdutos = jest.fn().mockResolvedValue(produtos);
    fetchEstoquistas = jest.fn().mockResolvedValue(estoquistas);
    getLocalizacoesPorProduto = jest.fn((allProdutos, produto) =>
      allProdutos.filter((item) => item.produto_externo_id === produto.produto_externo_id)
    );
    useToast.mockReturnValue({ showToast });
    navigate = jest.fn();
    useNavigate.mockReturnValue(navigate);
    usePermissions.mockReturnValue({ canCreateOc: true });
    useEmpresa.mockReturnValue({ activeEmpresa: { id: 10 } });
    useOCs.mockReturnValue({ createOcWithProducts, fetchEstoquistas });
    useProdutos.mockReturnValue({ fetchProdutos, getLocalizacoesPorProduto, isUsingMock: true });
  });

  it("renderiza os controles principais e carrega produtos da empresa ativa", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Gerar ordem de contagem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar produto")).toBeInTheDocument();
    expect(screen.getByLabelText("Estoquista respons\u00e1vel")).toBeDisabled();
    expect(screen.getByText("Nenhum produto selecionado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar OC" })).toBeDisabled();

    await waitForLoad();
    expect(screen.getByText("Dipirona 500mg")).toBeInTheDocument();
    expect(fetchEstoquistas).toHaveBeenCalledWith({ nivel: 1 });
  });

  it("filtra por nome e codigo e informa quando a busca nao encontra produtos", async () => {
    const user = userEvent;
    fetchProdutos.mockResolvedValue(catalogo);
    renderPage();
    await waitForLoad();

    await user.type(screen.getByLabelText("Buscar produto"), "AMO-500");
    expect(screen.getByText("Amoxicilina 500mg")).toBeInTheDocument();
    expect(screen.queryByText("Dipirona 500mg")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar produto"));
    await user.type(screen.getByLabelText("Buscar produto"), "inexistente");
    expect(screen.getByText("Nenhum produto encontrado")).toBeInTheDocument();
  });

  it("adiciona, impede duplicacao e remove um produto do carrinho", async () => {
    const user = userEvent;
    renderPage();
    await waitForLoad();

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("button", { name: "Adicionado" })).toBeDisabled();
    expect(showToast).toHaveBeenCalledWith("Produto adicionado \u00e0 OC.");

    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByText("Nenhum produto selecionado")).toBeInTheDocument();
  });

  it("mantem a geracao indisponivel sem produto ou responsavel", async () => {
    const user = userEvent;
    renderPage();
    await waitForLoad();

    expect(screen.getByRole("button", { name: "Gerar OC" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("button", { name: "Gerar OC" })).toBeDisabled();
    expect(createOcWithProducts).not.toHaveBeenCalled();
  });

  it("gera a OC com payload relevante, bloqueia duplo envio e navega apos sucesso", async () => {
    const user = userEvent;
    let resolveCreate;
    createOcWithProducts.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    renderPage();
    await addDipironaAndSelectEstoquista(user);

    const generateButton = screen.getByRole("button", { name: "Gerar OC" });
    await user.click(generateButton);
    expect(screen.getByRole("button", { name: "Gerando OC..." })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Gerando OC..." }));
    expect(createOcWithProducts).toHaveBeenCalledTimes(1);
    expect(createOcWithProducts).toHaveBeenCalledWith(expect.objectContaining({
      estoquista_id: "21",
      items: [expect.objectContaining({ produto: "Dipirona 500mg", codigo: "DIP-500", endereco: "A-01", saldo_sistema: 12 })]
    }));

    resolveCreate({ id: 88 });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("OC gerada com sucesso."));
    expect(navigate).toHaveBeenCalledWith("/gestor/oc/88", expect.objectContaining({ replace: true }));
  });

  it("exibe o erro de validacao da API sem limpar a selecao", async () => {
    const user = userEvent;
    createOcWithProducts.mockRejectedValue(new Error("Produto sem localizacao valida"));
    renderPage();
    await addDipironaAndSelectEstoquista(user);

    await user.click(screen.getByRole("button", { name: "Gerar OC" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Produto sem localizacao valida", "error"));
    expect(screen.getByRole("button", { name: "Adicionado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gerar OC" })).toBeEnabled();
  });

  it("recupera de uma falha generica de rede preservando o carrinho", async () => {
    const user = userEvent;
    createOcWithProducts.mockRejectedValue(new Error("Falha de rede"));
    renderPage();
    await addDipironaAndSelectEstoquista(user);

    await user.click(screen.getByRole("button", { name: "Gerar OC" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Falha de rede", "error"));
    expect(screen.getByRole("button", { name: "Adicionado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gerar OC" })).toBeEnabled();
  });

  it("ignora sucesso da criacao quando a empresa muda durante a mutation", async () => {
    let activeEmpresa = { id: 10 };
    let resolveCreate;
    useEmpresa.mockImplementation(() => ({ activeEmpresa }));
    createOcWithProducts.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const view = renderPage();
    await addDipironaAndSelectEstoquista(userEvent);
    showToast.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Gerar OC" }));
    activeEmpresa = { id: 20 };
    view.rerender(<GerarOC />);
    resolveCreate({ id: 88 });
    await waitFor(() => expect(fetchProdutos).toHaveBeenCalledTimes(2));
    expect(showToast).not.toHaveBeenCalledWith("OC gerada com sucesso.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mostra o erro de carregamento quando produtos ou estoquistas falham", async () => {
    fetchProdutos.mockRejectedValue(new Error("Servico indisponivel"));
    renderPage();

    expect(await screen.findByText("N\u00e3o foi poss\u00edvel carregar os produtos")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith("Servico indisponivel", "error");
  });
});
