type ClassValue = string | number | null | undefined | false | Record<string, boolean | null | undefined> | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v) continue;
    if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (Array.isArray(v)) out.push(cn(...v));
    else if (typeof v === "object") {
      for (const k in v) if (v[k]) out.push(k);
    }
  }
  return out.join(" ");
}
