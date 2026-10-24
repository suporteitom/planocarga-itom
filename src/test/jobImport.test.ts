import { describe, it, expect } from "vitest";
import { parseJobsPaste } from "@/lib/jobImport";

describe("parseJobsPaste", () => {
  it("lê a ordem Job|BI|Ambiente|Turno|Ciclo|Hora|Resultado|Obs e ignora cabeçalho", () => {
    const t = "Job – SAP PRO\tBI - Pastas\tAmbiente\tTurno\tCiclo\tHora\tResultado\tObs.\nZJOB1\tPASTA\tPRO-940\tManhã\tDU\t7:30\tN/EXEC\tnota";
    const [j, ...rest] = parseJobsPaste(t);
    expect(rest).toHaveLength(0);
    expect(j).toMatchObject({ job_name: "ZJOB1", bi_folder: "PASTA", environment: "PRO-940", shift: "manha", cycle: "DU", run_time: "07:30", result: "nexec", notes: "nota" });
  });
  it("marca turno inválido como erro", () => {
    expect(parseJobsPaste("ZJOB\t\t\tMadrugada")[0]?.error).toBeTruthy();
  });
});
