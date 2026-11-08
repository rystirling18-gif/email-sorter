import type { IncomingEmail } from "../types";
import { cleanBody, hashId, normalise } from "./text";

function unfold(headers: string): string {
  return headers.replace(/\r?\n[ \t]+/g, " ");
}

function decodeQuotedPrintable(input: string): string {
  const soft = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i += 1) {
    if (soft[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(soft.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(soft.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(soft.charCodeAt(i) & 0xff);
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
}

function decodeBase64(input: string): string {
  const cleaned = input.replace(/\s/g, "");
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodeEncodedWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g, (_all, _charset: string, encoding: string, data: string) => {
    if (encoding.toLowerCase() === "b") {
      try {
        return decodeBase64(data);
      } catch {
        return data;
      }
    }
    return decodeQuotedPrintable(data.replace(/_/g, " "));
  });
}

function headerMap(rawHeaders: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of unfold(rawHeaders).split(/\r?\n/)) {
    const split = line.indexOf(":");
    if (split === -1) continue;
    const key = line.slice(0, split).trim().toLowerCase();
    const value = decodeEncodedWords(line.slice(split + 1).trim());
    if (!map.has(key)) map.set(key, value);
  }
  return map;
}

function addressParts(value: string): { name: string; email: string } {
  const match = value.match(/^(.*)<([^>]+)>\s*$/);
  if (!match) {
    return { name: "", email: value.trim() };
  }
  return {
    name: normalise(match[1].replace(/^"|"$/g, "")),
    email: match[2].trim(),
  };
}

function stripHtml(html: string): string {
  return cleanBody(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function decodeBody(body: string, encoding: string): string {
  const kind = encoding.toLowerCase();
  if (kind.includes("base64")) {
    try {
      return decodeBase64(body);
    } catch {
      return body;
    }
  }
  if (kind.includes("quoted-printable")) return decodeQuotedPrintable(body);
  return body;
}

function partHeadersAndBody(part: string): { headers: Map<string, string>; body: string } {
  const split = part.search(/\r?\n\r?\n/);
  if (split === -1) return { headers: new Map(), body: part };
  const headerText = part.slice(0, split);
  const body = part.slice(split).replace(/^\r?\n\r?\n/, "");
  return { headers: headerMap(headerText), body };
}

function extractText(rawBody: string, headers: Map<string, string>): string {
  const contentType = headers.get("content-type") ?? "text/plain";
  const encoding = headers.get("content-transfer-encoding") ?? "";
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
  if (boundary && /multipart\//i.test(contentType)) {
    const parts = rawBody.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    let plain = "";
    let html = "";
    for (const part of parts) {
      if (!part.trim() || part.trim() === "--") continue;
      const parsed = partHeadersAndBody(part);
      const type = parsed.headers.get("content-type") ?? "";
      const decoded = decodeBody(parsed.body, parsed.headers.get("content-transfer-encoding") ?? "");
      if (/text\/plain/i.test(type) && !plain) plain = decoded;
      if (/text\/html/i.test(type) && !html) html = decoded;
    }
    return cleanBody(plain || stripHtml(html));
  }
  const decoded = decodeBody(rawBody, encoding);
  if (/text\/html/i.test(contentType)) return stripHtml(decoded);
  return cleanBody(decoded);
}

export function parseEml(raw: string): IncomingEmail {
  const normalised = raw.replace(/^\uFEFF/, "");
  const split = normalised.search(/\r?\n\r?\n/);
  const headerText = split === -1 ? normalised : normalised.slice(0, split);
  const body = split === -1 ? "" : normalised.slice(split);
  const headers = headerMap(headerText);
  const from = addressParts(headers.get("from") ?? "");
  const to = addressParts(headers.get("to") ?? "");
  const subject = headers.get("subject") ?? "(no subject)";
  const messageId = headers.get("message-id") ?? "";
  const dateHeader = headers.get("date");
  const parsedDate = dateHeader ? new Date(dateHeader) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
  const bodyText = extractText(body.replace(/^\r?\n\r?\n/, ""), headers).slice(0, 100_000);
  return {
    messageId: messageId || hashId([from.email, subject, date, bodyText.slice(0, 80)]),
    fromName: from.name,
    fromEmail: from.email,
    toEmail: to.email,
    subject,
    bodyText,
    date,
  };
}
