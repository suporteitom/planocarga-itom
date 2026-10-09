import { describe, expect, it } from "vitest";
import { interventionInShift, nextShift, prevShift, shiftOf, shiftWindow } from "@/lib/shifts";

describe("turnos (America/Sao_Paulo)", () => {
  it("02:00 em SP pertence ao turno da noite do dia anterior", () => {
    expect(shiftOf(new Date("2026-10-10T05:00:00Z"))).toEqual({ date: "2026-10-09", shift: "noite" });
  });
  it("07:00 em SP é manhã", () => {
    expect(shiftOf(new Date("2026-10-10T10:00:00Z"))).toEqual({ date: "2026-10-10", shift: "manha" });
  });
  it("23:00 em SP é noite do mesmo dia", () => {
    expect(shiftOf(new Date("2026-10-11T02:00:00Z"))).toEqual({ date: "2026-10-10", shift: "noite" });
  });
  it("janela da noite vai de 23:00 até 07:00 do dia seguinte", () => {
    const w = shiftWindow({ date: "2026-10-09", shift: "noite" });
    expect(w.start.toISOString()).toBe("2026-10-10T02:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-10T10:00:00.000Z");
  });
  it("próximo turno após a noite é a manhã do dia seguinte", () => {
    expect(nextShift({ date: "2026-10-09", shift: "noite" })).toEqual({ date: "2026-10-10", shift: "manha" });
    expect(prevShift({ date: "2026-10-10", shift: "manha" })).toEqual({ date: "2026-10-09", shift: "noite" });
  });
  it("intervenção 14:00–16:00 aparece na manhã e na tarde, não na noite", () => {
    const s = "2026-10-10T17:00:00Z"; // 14:00 SP
    const e = "2026-10-10T19:00:00Z"; // 16:00 SP
    expect(interventionInShift(s, e, { date: "2026-10-10", shift: "manha" })).toBe(true);
    expect(interventionInShift(s, e, { date: "2026-10-10", shift: "tarde" })).toBe(true);
    expect(interventionInShift(s, e, { date: "2026-10-10", shift: "noite" })).toBe(false);
  });
});
