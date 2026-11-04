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

import { typeFromEmail } from "@/lib/emailImport";
describe("e-mail Alteração de Perfil", () => {
  it("tipo", () => expect(typeFromEmail("RE: SNS 24 | Alteração de Perfil")).toBe("Alteração de Perfil"));
  it("tipo update", () => expect(typeFromEmail("BPO-HR - Instalação de updates")).toBe("Update"));
  it("a partir das 00H", () => expect(windowFromBody("Data/hora:  A PARTIR DAS 00H DO DIA 28-10-2026")).toEqual({ date: "2026-10-28", start: "00:00", end: null }));
});
