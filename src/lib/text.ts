export function normalise(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

export function cleanBody(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function lower(value: string): string {
  return normalise(value).toLowerCase();
}

export function emailAddress(value: string): string {
  return lower(value).replace(/^mailto:/, "");
}

export function domainOf(email: string): string {
  const at = emailAddress(email).lastIndexOf("@");
  return at === -1 ? "" : emailAddress(email).slice(at + 1);
}

export function includesDomain(domain: string, list: string[]): boolean {
  const host = domain.toLowerCase();
  return list.some((entry) => {
    const needle = entry.trim().toLowerCase().replace(/^@/, "");
    if (!needle) return false;
    return host === needle || host.endsWith(`.${needle}`);
  });
}

export function looksLikeEducationDomain(domain: string): boolean {
  const host = domain.toLowerCase();
  return (
    host.endsWith(".sch.uk") ||
    host.endsWith(".ac.uk") ||
    host.endsWith(".edu") ||
    host.endsWith(".edu.au") ||
    host.endsWith(".k12.us")
  );
}

export function firstName(fullName: string): string {
  const cleaned = normalise(fullName).replace(/[.,]/g, "");
  if (!cleaned) return "";
  return cleaned.split(" ")[0] ?? "";
}

export function hashId(parts: string[]): string {
  const input = parts.join("|").toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `m_${(hash >>> 0).toString(16)}`;
}

export function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
