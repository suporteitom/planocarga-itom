import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TZ = "Europe/Lisbon";

export type ShiftKey = "manha" | "tarde" | "noite";
export interface ShiftRef {
  date: string; // yyyy-MM-dd (dia do plano; a noite 23h–07h abre o dia)
  shift: ShiftKey;
}

export const SHIFTS: { key: ShiftKey; label: string; hours: string; startHour: number }[] = [
  { key: "noite", label: "Noite", hours: "23:00–07:00", startHour: 23 },
  { key: "manha", label: "Manhã", hours: "07:00–15:00", startHour: 7 },
  { key: "tarde", label: "Tarde", hours: "15:00–23:00", startHour: 15 },
];

export const shiftLabel = (k: string) => SHIFTS.find((s) => s.key === k)?.label ?? k;

const pad = (n: number) => String(n).padStart(2, "0");

export function addDays(date: string, n: number): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Converte data/hora local de São Paulo para Date (UTC). */
export function fromSp(date: string, time = "00:00"): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? time + ":00" : time}`, TZ);
}

/** Partes locais (São Paulo) de um instante. */
export function spParts(iso: string | Date | null | undefined) {
  if (!iso) return { date: "", time: "", dt: "", br: "" };
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return {
    date: formatInTimeZone(d, TZ, "yyyy-MM-dd"),
    time: formatInTimeZone(d, TZ, "HH:mm"),
    dt: formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm"),
    br: formatInTimeZone(d, TZ, "dd/MM/yyyy HH:mm"),
  };
}

/** datetime-local (SP) -> ISO UTC */
export function dtLocalToIso(v: string): string | null {
  if (!v) return null;
  const [d, t] = v.split("T");
  return fromSp(d ?? "", t ?? "00:00").toISOString();
}

export function shiftWindow({ date, shift }: ShiftRef): { start: Date; end: Date } {
  if (shift === "manha") return { start: fromSp(date, "07:00"), end: fromSp(date, "15:00") };
  if (shift === "tarde") return { start: fromSp(date, "15:00"), end: fromSp(date, "23:00") };
  return { start: fromSp(addDays(date, -1), "23:00"), end: fromSp(date, "07:00") };
}

/** Turno ao qual um instante pertence (a noite das 23h abre o dia/plano seguinte). */
export function shiftOf(instant: Date = new Date()): ShiftRef {
  const date = formatInTimeZone(instant, TZ, "yyyy-MM-dd");
  const h = Number(formatInTimeZone(instant, TZ, "H"));
  if (h < 7) return { date, shift: "noite" };
  if (h < 15) return { date, shift: "manha" };
  if (h < 23) return { date, shift: "tarde" };
  return { date: addDays(date, 1), shift: "noite" };
}

export function nextShift(r: ShiftRef): ShiftRef {
  if (r.shift === "noite") return { date: r.date, shift: "manha" };
  if (r.shift === "manha") return { date: r.date, shift: "tarde" };
  return { date: addDays(r.date, 1), shift: "noite" };
}

export function prevShift(r: ShiftRef): ShiftRef {
  if (r.shift === "tarde") return { date: r.date, shift: "manha" };
  if (r.shift === "manha") return { date: r.date, shift: "noite" };
  return { date: addDays(r.date, -1), shift: "tarde" };
}

/** Uma intervenção aparece em todo turno cujo intervalo ela toca. */
export function interventionInShift(startIso: string, endIso: string | null, r: ShiftRef): boolean {
  const { start, end } = shiftWindow(r);
  const s = new Date(startIso).getTime();
  const e = endIso ? new Date(endIso).getTime() : s;
  if (e <= s) return s >= start.getTime() && s < end.getTime();
  return s < end.getTime() && e > start.getTime();
}

export const brDate = (date: string) => date.split("-").reverse().join("/");
export { pad };
