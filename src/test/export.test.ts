import { describe, expect, it } from "vitest";
import { exportFileName } from "../lib/export";

describe("exportFileName", () => {
  it("inclui o turno escolhido no nome do ficheiro", () => {
    expect(exportFileName("plano-carga-itom", "2026-10-19", "2026-10-19", "tarde")).toBe(
      "plano-carga-itom_2026-10-19_a_2026-10-19_tarde.xlsx",
    );
  });

  it("usa o nome do turno em minúsculas e sem acentos", () => {
    expect(exportFileName("plano-carga-itom", "2026-10-19", "2026-10-19", "manha")).toBe(
      "plano-carga-itom_2026-10-19_a_2026-10-19_manha.xlsx",
    );
    expect(exportFileName("passagem-turno", "2026-10-19", "2026-10-19", "noite")).toBe(
      "passagem-turno_2026-10-19_a_2026-10-19_noite.xlsx",
    );
  });

  it("não inclui turno quando nenhum foi escolhido", () => {
    expect(exportFileName("plano-carga-itom", "2026-10-12", "2026-10-19")).toBe(
      "plano-carga-itom_2026-10-12_a_2026-10-19.xlsx",
    );
    expect(exportFileName("plano-carga-itom", "2026-10-12", "2026-10-19", "")).toBe(
      "plano-carga-itom_2026-10-12_a_2026-10-19.xlsx",
    );
  });
});
