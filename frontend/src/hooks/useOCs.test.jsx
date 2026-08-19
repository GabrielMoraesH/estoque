import { renderHook } from "@testing-library/react";
import useOCs from "./useOCs";
import useEmpresa from "./useEmpresa";
import {
  createOCWithItems,
  getOCsByGestor,
  getOCsForApproval,
  sendItemsToRecount
} from "../services/api";

jest.mock("./useEmpresa", () => jest.fn());
jest.mock("../services/api", () => ({
  approveOC: jest.fn(),
  createOCWithItems: jest.fn(),
  finalizarOC: jest.fn(),
  getEstoquistas: jest.fn(),
  getItemsByOC: jest.fn(),
  getOCsByEstoquista: jest.fn(),
  getOCsByGestor: jest.fn(),
  getOcHistoryDetails: jest.fn(),
  getOCsForApproval: jest.fn(),
  salvarContagem: jest.fn(),
  reassignOcAssignment: jest.fn(),
  sendItemsToRecount: jest.fn()
}));

describe("useOCs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEmpresa.mockReturnValue({ activeEmpresa: { id: 10 } });
  });

  it("expõe callbacks que delegam à API sem iniciar buscas automaticamente", () => {
    const { result } = renderHook(() => useOCs());
    const payload = { titulo: "OC de teste" };
    const created = { id: 1 };
    const listed = [{ id: 2 }];
    const recounted = { ok: true };
    createOCWithItems.mockReturnValue(created);
    getOCsByGestor.mockReturnValue(listed);
    sendItemsToRecount.mockReturnValue(recounted);

    expect(getOCsByGestor).not.toHaveBeenCalled();
    expect(result.current.createOcWithProducts(payload)).toBe(created);
    expect(result.current.fetchGestorOCs({ role: "gestor" })).toBe(listed);
    expect(result.current.sendOcItemsToRecount(5, [3, 4], 9)).toBe(recounted);
    expect(createOCWithItems).toHaveBeenCalledWith(payload);
    expect(getOCsByGestor).toHaveBeenCalledWith({ role: "gestor" });
    expect(sendItemsToRecount).toHaveBeenCalledWith(5, [3, 4], 9);
  });

  it("propaga resultados e erros da API, inclusive 401 e 403", async () => {
    const unauthorized = Object.assign(new Error("Sessão expirada"), { status: 401 });
    const forbidden = Object.assign(new Error("Acesso negado"), { status: 403 });
    createOCWithItems.mockResolvedValue({ id: 7 });
    getOCsByGestor.mockRejectedValue(unauthorized);
    getOCsForApproval.mockRejectedValue(forbidden);
    const { result } = renderHook(() => useOCs());

    await expect(result.current.createOcWithProducts({})).resolves.toEqual({ id: 7 });
    await expect(result.current.fetchGestorOCs({})).rejects.toBe(unauthorized);
    await expect(result.current.fetchApprovalOCs({ role: "gestor" })).rejects.toBe(forbidden);
  });

  it("renova os callbacks quando a empresa ativa muda, sem disparar requisição ou reter dados", () => {
    const { result, rerender } = renderHook(() => useOCs());
    const callbackDaEmpresaA = result.current.fetchGestorOCs;

    useEmpresa.mockReturnValue({ activeEmpresa: { id: 20 } });
    rerender();

    expect(result.current.fetchGestorOCs).not.toBe(callbackDaEmpresaA);
    expect(getOCsByGestor).not.toHaveBeenCalled();
  });
});
