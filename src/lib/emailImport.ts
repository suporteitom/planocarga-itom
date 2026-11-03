// Parse Outlook .msg files and derive intervention fields.

/** Client name from the start of a subject: "[ACME] x", "ACME - x", "ACME: x", "RE: ACME | x" or first word. */
export function clientFromSubject(subject: string): string | null {
  let s = subject.trim().replace(/^((re|res|fw|fwd|enc|tr)\s*:\s*)+/i, "").trim();
  if (!s) return null;
  const br = s.match(/^[[(]\s*([^\])]+?)\s*[\])]/);
  if (br) return br[1]!.trim();
  const sep = s.match(/^(.+?)\s*(?:\s[-–—|]\s|:|\s[-–—|]|[-–—|]\s)/);
  if (sep && sep[1]!.trim().length <= 40) return sep[1]!.trim();
  return s.split(/\s+/)[0] ?? null;
}

export type ParsedEmail = { subject: string; client: string | null; sender: string | null; sentAt: string | null };

export async function parseMsgFile(file: File): Promise<ParsedEmail> {
  const mod = (await import("@kenjiuno/msgreader")) as unknown as { default?: unknown };
  const d0 = mod.default as { default?: unknown } | undefined;
  const MsgReader = (typeof d0 === "function" ? d0 : d0?.default) as new (b: ArrayBuffer) => { getFileData(): unknown };
  const buf = await file.arrayBuffer();
  const info = new MsgReader(buf).getFileData() as {
    subject?: string; senderName?: string; senderEmail?: string; clientSubmitTime?: string; messageDeliveryTime?: string; creationTime?: string; error?: string;
  };
  if (info.error) throw new Error(info.error);
  const subject = (info.subject ?? file.name.replace(/\.msg$/i, "")).trim();
  const raw = info.clientSubmitTime ?? info.messageDeliveryTime ?? info.creationTime;
  const d = raw ? new Date(raw) : null;
  return {
    subject,
    client: clientFromSubject(subject),
    sender: info.senderName?.trim() || info.senderEmail?.trim() || null,
    sentAt: d && !isNaN(d.getTime()) ? d.toISOString() : null,
  };
}
