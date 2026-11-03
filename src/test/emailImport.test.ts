import { describe, expect, it } from "vitest";
import { clientFromSubject } from "@/lib/emailImport";

describe("clientFromSubject", () => {
  it("brackets", () => expect(clientFromSubject("[CTT] Janela de manutenção")).toBe("CTT"));
  it("hyphen", () => expect(clientFromSubject("EDP - Update SAP")).toBe("EDP"));
  it("colon", () => expect(clientFromSubject("Galp: paragem")).toBe("Galp"));
  it("strips RE/FW", () => expect(clientFromSubject("RE: FW: NOS - Intervenção")).toBe("NOS"));
  it("first word fallback", () => expect(clientFromSubject("Sonae intervenção amanhã")).toBe("Sonae"));
});
