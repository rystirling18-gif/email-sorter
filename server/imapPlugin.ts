import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";
import type { IncomingEmail } from "../src/types";

function loadEnvFile(root: string) {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function imapConfig(root: string): { host: string; port: number; user: string; pass: string } | null {
  loadEnvFile(root);
  const host = process.env.IMAP_HOST?.trim() ?? "";
  const user = process.env.IMAP_USER?.trim() ?? "";
  const pass = process.env.IMAP_PASSWORD ?? "";
  const port = Number(process.env.IMAP_PORT || 993);
  if (!host || !user || !pass || host === "imap.example.com" || pass === "replace-me") return null;
  return { host, port, user, pass };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function addressText(input: { value?: Array<{ name?: string; address?: string }> } | Array<{ value?: Array<{ name?: string; address?: string }> }> | undefined): { name: string; email: string } {
  const entry = Array.isArray(input) ? input[0] : input;
  const item = entry?.value?.[0];
  return {
    name: item?.name ?? "",
    email: item?.address ?? "",
  };
}

async function readInbox(root: string): Promise<IncomingEmail[]> {
  const config = imapConfig(root);
  if (!config) {
    throw new Error("IMAP is not configured.");
  }
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.port !== 143,
    auth: { user: config.user, pass: config.pass },
    logger: false,
    socketTimeout: 20_000,
  });
  await client.connect();
  const emails: IncomingEmail[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    const status = await client.status("INBOX", { uidNext: true });
    const start = Math.max(1, Number(status.uidNext ?? 1) - 150);
    for await (const message of client.fetch(`${start}:*`, { uid: true, source: true })) {
      if (!message.source) continue;
      const parsed = await simpleParser(message.source);
      const from = addressText(parsed.from);
      const to = addressText(parsed.to);
      const body = (parsed.text || parsed.html || "").toString().slice(0, 100_000);
      emails.push({
        messageId: parsed.messageId || `imap-${message.uid}`,
        fromName: from.name,
        fromEmail: from.email,
        toEmail: to.email,
        subject: parsed.subject || "(no subject)",
        bodyText: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        date: (parsed.date ?? new Date()).toISOString(),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return emails;
}

function attach(middlewares: Connect.Server, root: string) {
  middlewares.use("/api/sync/status", (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    send(res, 200, { configured: imapConfig(root) !== null });
  });

  middlewares.use("/api/sync", (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }
    if (!imapConfig(root)) {
      send(res, 200, {
        configured: false,
        emails: [],
        message: "Add IMAP_HOST, IMAP_USER, and IMAP_PASSWORD to the local .env file, then restart the dev server.",
      });
      return;
    }
    void readInbox(root)
      .then((emails) => send(res, 200, { configured: true, emails }))
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "Unknown IMAP error";
        console.error("IMAP sync failed:", detail);
        send(res, 502, { configured: true, emails: [], message: "The mailbox could not be read. Check the host, username, and password." });
      });
  });
}

export function imapSyncPlugin(): Plugin {
  return {
    name: "imap-sync",
    configureServer(server: ViteDevServer) {
      attach(server.middlewares, server.config.root);
    },
    configurePreviewServer(server: PreviewServer) {
      attach(server.middlewares, server.config.root);
    },
  };
}
