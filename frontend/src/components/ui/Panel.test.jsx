import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Panel from "./Panel";

describe("Panel", () => {
  it("encaminha props do elemento e preserva as classes ao renderizar como formulario", async () => {
    const handleSubmit = jest.fn((event) => event.preventDefault());

    render(
      <Panel
        as="form"
        className="custom-panel"
        aria-label="Formulario administrativo"
        data-testid="admin-panel"
        onSubmit={handleSubmit}
      >
        <button type="submit">Enviar</button>
      </Panel>
    );

    const panel = screen.getByTestId("admin-panel");
    expect(panel).toHaveAttribute("aria-label", "Formulario administrativo");
    expect(panel).toHaveClass("panel-card", "custom-panel");

    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});
