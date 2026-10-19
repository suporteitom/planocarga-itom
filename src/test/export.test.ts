import { describe, expect, it } from "vitest";
import { exportFileName, summaryRows } from "../lib/export";

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

describe("summaryRows", () => {
  const sheets = [
    { name: "Recados", rows: [1, 2, 3] },
    { name: "Intervenções", rows: [] as unknown[] },
    { name: "Monitoramento de Jobs", rows: [1] },
  ];
  const when = new Date("2026-10-19T16:40:00Z");

  it("traz data de geração em Lisboa, período, turno e registos por guia", () => {
    const rows = summaryRows("2026-10-19", "2026-10-19", "tarde", when, sheets);
    expect(rows[1]).toEqual(["Gerado em", "19/10/2026 17:40"]);
    expect(rows[3]).toEqual(["Período", "19/10/2026"]);
    expect(rows[4]).toEqual(["Turno selecionado", "Tarde"]);
    expect(rows.slice(6)).toEqual([
      ["Guia", "Registos"],
      ["Recados", 3],
      ["Intervenções", 0],
      ["Monitoramento de Jobs", 1],
      ["Total", 4],
    ]);
  });

  it("mostra o intervalo de dias e 'Todos' quando nenhum turno foi escolhido", () => {
    const rows = summaryRows("2026-10-12", "2026-10-19", "", when, sheets);
    expect(rows[3]).toEqual(["Período", "12/10/2026 a 19/10/2026"]);
    expect(rows[4]).toEqual(["Turno selecionado", "Todos"]);
    expect(rows[0]?.[0]).toBe("PLANO DE CARGA - ITOM");
  });
});
