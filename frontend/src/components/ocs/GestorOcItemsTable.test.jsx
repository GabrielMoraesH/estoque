import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import GestorOcItemsTable from "./GestorOcItemsTable";

describe("GestorOcItemsTable", () => {
  it("exibe saldos, diferença, status, contagens e abre lotes do produto escolhido", async () => {
    const onOpenLotDetails = jest.fn();
    const items = [
      { produto: "Dipirona", saldoSistema: 10, saldoContado: 12, diferenca: 2, consolidatedStatus: "recontagem", countingTrace: { hasCount: true, hasRecount: true, first: { userName: "Ana", date: "2026-01-01T10:00:00Z" }, last: { userName: "Bruno", date: "2026-01-02T10:00:00Z" } } },
      { produto: "Amoxicilina", saldoSistema: 5, saldoContado: 5, diferenca: 0, consolidatedStatus: "aprovado", countingTrace: { hasCount: false } }
    ];
    render(<GestorOcItemsTable items={items} onOpenLotDetails={onOpenLotDetails} />);

    const row = screen.getByRole("cell", { name: "Dipirona" }).closest("tr");
    expect(row).toHaveTextContent("10");
    expect(row).toHaveTextContent("12");
    expect(row).toHaveTextContent("+2");
    expect(row).toHaveTextContent("Recontagem");
    expect(row).toHaveTextContent("Primeira contagem: Ana");
    expect(row).toHaveTextContent("Recontagem: Bruno");
    await userEvent.click(within(row).getByRole("button", { name: "Ver lotes" }));
    expect(onOpenLotDetails).toHaveBeenCalledWith(expect.objectContaining({ produto: "Dipirona" }));
  });

  it("apresenta o estado vazio real", () => {
    render(<GestorOcItemsTable items={[]} onOpenLotDetails={jest.fn()} />);
    expect(screen.getByText("Nenhum item encontrado")).toBeInTheDocument();
  });
});
