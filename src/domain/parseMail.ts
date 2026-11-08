import type { IncomingEmail } from "./types";

export interface ParsedMail extends IncomingEmail {
  date: string | null;
}

export function parseEml(raw: string): ParsedMail {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const splitAt = text.search(/\n\n/);
  const headerBlock = splitAt === -1 ? text : text.slice(0, splitAt);
  const body = splitAt === -1 ? "" : text.slice(splitAt + 2).trim();
  const headers = unfoldHeaders(headerBlock);
  const from = splitAddress(headers.get("from") ?? "");
  const to = (headers.get("to") ?? "")
    .split(",")
    .map((part) => splitAddress(part).email)
    .filter(Boolean);
  const dateHeader = headers.get("date");
  const parsedDate = dateHeader ? new Date(dateHeader) : null;
  return {
    fromName: from.name,
    fromEmail: from.email,
    to,
    subject: decodeHeader(headers.get("subject") ?? "(no subject)"),
    body: decodeBody(body, headers.get("content-transfer-encoding") ?? ""),
    date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
  };
}

export function parseMailJson(raw: string): ParsedMail[] {
  const data = JSON.parse(raw) as unknown;
  const rows = Array.isArray(data) ? data : [data];
  return rows.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new Error(`Item ${index + 1} is not an email object.`);
    }
    const record = row as Record<string, unknown>;
    const fromEmail = stringField(record, "fromEmail") || stringField(record, "from");
    if (!fromEmail.includes("@")) {
      throw new Error(`Item ${index + 1} needs a from email address.`);
    }
    return {
      fromName: stringField(record, "fromName"),
      fromEmail,
      to: Array.isArray(record.to) ? record.to.map(String) : splitList(stringField(record, "to")),
      subject: stringField(record, "subject") || "(no subject)",
      body: stringField(record, "body") || stringField(record, "text") || "",
      date: stringField(record, "date") || null,
    };
  });
}

function unfoldHeaders(block: string): Map<string, string> {
  const lines = block.replace(/\n[ \t]+/g, " ").split("\n");
  const headers = new Map<string, string>();
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return headers;
}

function splitAddress(value: string): { name: string; email: string } {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (match) return { name: decodeHeader(match[1].trim()), email: match[2].trim() };
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return { name: "", email: email?.[0] ?? value.trim() };
}

function decodeHeader(value: string): string {
  return value.replace(/=\?UTF-8\?Q\?(.+?)\?=/gi, (_, text: string) =>
    decodeQuotedPrintable(text.replace(/_/g, " ")),
  );
}

function decodeBody(body: string, encoding: string): string {
  if (encoding.toLowerCase().includes("quoted-printable")) return decodeQuotedPrintable(body);
  return body;
}

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = [];
  const input = value.replace(/=\n/g, "");
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === "=" && /[0-9A-F]{2}/i.test(input.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(input.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(input.charCodeAt(i));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
