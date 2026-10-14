import { describe, expect, it } from "vitest";
import { interventionInShift, nextShift, prevShift, shiftOf, shiftWindow } from "@/lib/shifts";

describe("turnos (Europe/Lisbon) — o dia começa pela noite", () => {
  it("02:00 em SP é a noite do próprio dia", () => {
    expect(shiftOf(new Date("2026-10-10T01:00:00Z"))).toEqual({ date: "2026-10-10", shift: "noite" });
  });
  it("07:00 em SP é manhã", () => {
    expect(shiftOf(new Date("2026-10-10T06:00:00Z"))).toEqual({ date: "2026-10-10", shift: "manha" });
  });
  it("23:00 em SP já é a noite do dia seguinte (novo plano)", () => {
    expect(shiftOf(new Date("2026-10-10T22:00:00Z"))).toEqual({ date: "2026-10-11", shift: "noite" });
  });
  it("noite do dia 10 vai de 23:00 do dia 9 até 07:00 do dia 10", () => {
    const w = shiftWindow({ date: "2026-10-10", shift: "noite" });
    expect(w.start.toISOString()).toBe("2026-10-09T22:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-10T06:00:00.000Z");
  });
  it("ordem: noite → manhã → tarde → noite do dia seguinte", () => {
    expect(nextShift({ date: "2026-10-10", shift: "noite" })).toEqual({ date: "2026-10-10", shift: "manha" });
    expect(nextShift({ date: "2026-10-10", shift: "tarde" })).toEqual({ date: "2026-10-11", shift: "noite" });
    expect(prevShift({ date: "2026-10-10", shift: "noite" })).toEqual({ date: "2026-10-09", shift: "tarde" });
  });
  it("intervenção 14:00–16:00 aparece na manhã e na tarde, não na noite", () => {
    const s = "2026-10-10T13:00:00Z";
    const e = "2026-10-10T15:00:00Z";
    expect(interventionInShift(s, e, { date: "2026-10-10", shift: "manha" })).toBe(true);
    expect(interventionInShift(s, e, { date: "2026-10-10", shift: "tarde" })).toBe(true);
    expect(interventionInShift(s, e, { date: "2026-10-10", shift: "noite" })).toBe(false);
  });
});

import { cycleAppliesOn } from "@/lib/shifts";
describe("cycleAppliesOn", () => {
  it("DU only weekdays", () => { expect(cycleAppliesOn("DU", "2026-10-14")).toBe(true); expect(cycleAppliesOn("DU", "2026-10-17")).toBe(false); });
  it("weekday cycle", () => { expect(cycleAppliesOn("sábado", "2026-10-17")).toBe(true); expect(cycleAppliesOn("segunda-feira", "2026-10-14")).toBe(false); });
  it("monthly day 5", () => { expect(cycleAppliesOn("MENSAL - DIA 5", "2026-10-05")).toBe(true); expect(cycleAppliesOn("MENSAL - DIA 5", "2026-10-06")).toBe(false); });
  it("daily always", () => expect(cycleAppliesOn("DIÁRIO", "2026-10-18")).toBe(true));
});
