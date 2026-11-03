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

/** Reads Outlook .msg (OLE compound file) fully in the browser via cfb. */
export async function parseMsgFile(file: File): Promise<ParsedEmail> {
  const CFB = await import("cfb");
  const cfb = CFB.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  const rootEntry = (name: string) => {
    for (let i = 0; i < cfb.FullPaths.length; i++) {
      const parts = cfb.FullPaths[i]!.split("/").filter(Boolean);
      if (parts.length === 2 && parts[1]!.toLowerCase() === name.toLowerCase()) return cfb.FileIndex[i];
    }
    return null;
  };
  const str = (tag: string): string | null => {
    const u = rootEntry(`__substg1.0_${tag}001F`);
    if (u?.content) {
      const c = new Uint8Array(u.content as ArrayLike<number>);
      return new TextDecoder("utf-16le").decode(c).replace(/\0[\s\S]*$/, "").trim() || null;
    }
    const a = rootEntry(`__substg1.0_${tag}001E`);
    if (a?.content) {
      const c = new Uint8Array(a.content as ArrayLike<number>);
      return new TextDecoder("windows-1252").decode(c).replace(/\0[\s\S]*$/, "").trim() || null;
    }
    return null;
  };
  const times: Record<number, Date> = {};
  const props = rootEntry("__properties_version1.0");
  if (props?.content) {
    const u8 = new Uint8Array(props.content as ArrayLike<number>);
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    for (let o = 32; o + 16 <= u8.length; o += 16) {
      if (v.getUint16(o, true) !== 0x0040) continue;
      const n = BigInt(v.getUint32(o + 12, true)) * 0x100000000n + BigInt(v.getUint32(o + 8, true));
      const d = new Date(Number((n - 116444736000000000n) / 10000n));
      if (!isNaN(d.getTime())) times[v.getUint16(o + 2, true)] = d;
    }
  }
  const subject = (str("0037") ?? file.name.replace(/\.msg$/i, "")).trim();
  const d = times[0x0039] ?? times[0x0e06] ?? times[0x3007] ?? null;
  return {
    subject,
    client: clientFromSubject(subject),
    sender: str("0C1A") ?? str("0042") ?? str("0C1F") ?? str("5D01"),
    sentAt: d ? d.toISOString() : null,
  };
}
