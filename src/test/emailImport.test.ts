import { describe, expect, it } from "vitest";
import { clientFromSubject } from "@/lib/emailImport";

describe("clientFromSubject", () => {
  it("brackets", () => expect(clientFromSubject("[CTT] Janela de manutenção")).toBe("CTT"));
  it("hyphen", () => expect(clientFromSubject("EDP - Update SAP")).toBe("EDP"));
  it("colon", () => expect(clientFromSubject("Galp: paragem")).toBe("Galp"));
  it("strips RE/FW", () => expect(clientFromSubject("RE: FW: NOS - Intervenção")).toBe("NOS"));
  it("first word fallback", () => expect(clientFromSubject("Sonae intervenção amanhã")).toBe("Sonae"));
});

import { windowFromBody } from "@/lib/emailImport";
describe("windowFromBody", () => {
  it("extenso + colchetes", () => expect(windowFromBody("Data da intervenção:\n03 de novembro de 2026, na janela horária acordada [03:00 – 05:00]")).toEqual({ date: "2026-11-03", start: "03:00", end: "05:00" }));
  it("numérica + às", () => expect(windowFromBody("Dia 3/11/2026 das 22h00 às 01h30")).toEqual({ date: "2026-11-03", start: "22:00", end: "01:30" }));
  it("sem data", () => expect(windowFromBody("olá").date).toBeNull());
});
