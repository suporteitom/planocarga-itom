// Interpreta linhas coladas do Excel (separadas por TAB) na ordem:
// Job – SAP PRO | BI - Pastas | Ambiente | Turno | Ciclo | Hora | Resultado | Obs.
export type ParsedJob = {
  job_name: string; bi_folder: string | null; environment: string | null;
  shift: string; cycle: string; run_time: string | null;
  result: string | null; notes: string | null; error?: string;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function parseShift(s: string): string | null {
  const n = norm(s);
  if (!n) return null;
  if (n.startsWith("noite")) return "noite";
  if (n.startsWith("manh")) return "manha";
  if (n.startsWith("tarde")) return "tarde";
  return null;
}

export function parseResult(s: string): string | null {
  const n = norm(s).replace(/\s/g, "");
  const map: Record<string, string> = { ok: "ok", nok: "nok", "n/a": "na", na: "na", exec: "exec", "n/exec": "nexec", nexec: "nexec", pendente: "pendente" };
  return map[n] ?? null;
}

export function parseTime(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[:h.](\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  const f = Number(s.replace(",", "."));
  if (s.trim() && !Number.isNaN(f) && f >= 0 && f < 1) {
    const mins = Math.round(f * 1440);
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  return s.trim() || null;
}

export function parseJobsPaste(text: string): ParsedJob[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length && norm(lines[0]).startsWith("job")) lines.shift();
  return lines.map((l) => {
    const c = l.split("\t").map((x) => x.trim().replace(/^"|"$/g, ""));
    const shift = parseShift(c[3] ?? "");
    const job: ParsedJob = {
      job_name: c[0] ?? "", bi_folder: c[1] || null, environment: c[2] || null,
      shift: shift ?? "noite", cycle: c[4] || "Diário", run_time: parseTime(c[5] ?? ""),
      result: parseResult(c[6] ?? ""), notes: c[7] || null,
    };
    if (!job.job_name) job.error = "Sem nome do job";
    else if (!shift) job.error = `Turno inválido: "${c[3] ?? ""}"`;
    return job;
  });
}
