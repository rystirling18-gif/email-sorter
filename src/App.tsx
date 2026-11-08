import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { archiveMessage, fileAs, flagForReview, moveToSpam, restoreMessage } from "./lib/actions";
import { filterMessages, FOLDERS } from "./lib/folders";
import { formatWhen, lines } from "./lib/format";
import { addEmails, messageFromIncoming, organiseMailbox, summarise } from "./lib/organise";
import { parseEml } from "./lib/parseEml";
import { sampleEmails } from "./lib/sample";
import { deletionDecision, spamDecision } from "./lib/safety";
import { loadMailbox, saveMailbox } from "./lib/storage";
import { DEFAULT_SETTINGS, type Category, type FolderId, type Message, type Settings } from "./types";

type Panel = "settings" | "import" | "rules" | null;
type DialogState =
  | { kind: "school-delete"; id: string }
  | { kind: "spam-uncertain"; id: string }
  | { kind: "delete-spam"; id: string }
  | { kind: "empty-spam" }
  | { kind: "remove-samples" }
  | { kind: "restore-samples" };

const FILE_CATEGORIES: Category[] = [
  "personal",
  "school",
  "new_client_lead",
  "client",
  "important",
  "finance",
  "accounts",
  "receipts",
  "subscriptions",
  "social",
  "newsletters",
  "review",
];

const CATEGORY_NAME: Record<Category, string> = {
  personal: "Personal",
  school: "School",
  client: "Client",
  new_client_lead: "New client lead",
  important: "Important",
  finance: "Finance",
  accounts: "Accounts",
  subscriptions: "Subscriptions",
  receipts: "Receipts",
  social: "Social media",
  newsletters: "Newsletters",
  spam: "Spam",
  review: "Needs review",
};

function sealText(businessName: string): string {
  const token = businessName.trim().split(/\s+/)[0] ?? "RS";
  return token.slice(0, 2).toUpperCase() || "RS";
}

function lockCopy(message: Message): string | null {
  switch (message.safetyLock) {
    case "self":
    case "personal":
      return "Protected personal mail. This is never deleted.";
    case "school":
      return "Protected school mail. It stays unless you specifically approve deletion.";
    case "client":
      return "Protected client mail. This is never deleted.";
    case "lead":
      return "Protected new client lead. This is never deleted.";
    case "uncertain":
      return "Kept for review. It is not deleted while it is uncertain.";
    default:
      return message.important ? "Marked important. It stays out of spam." : null;
  }
}

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [usingSample, setUsingSample] = useState(true);
  const [ready, setReady] = useState(false);
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncConfigured, setSyncConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    const saved = loadMailbox();
    if (saved && saved.messages.length > 0) {
      setSettings(saved.settings);
      setMessages(saved.messages);
      setUsingSample(saved.usingSample);
    } else {
      const seeded = sampleEmails(DEFAULT_SETTINGS).map((email) =>
        messageFromIncoming(email, DEFAULT_SETTINGS, { sample: true }),
      );
      setSettings(DEFAULT_SETTINGS);
      setMessages(seeded);
      setUsingSample(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveMailbox({ settings, messages, usingSample });
  }, [ready, settings, messages, usingSample]);

  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    const first = filterMessages(messages, "inbox", "")[0];
    if (first) setSelectedId(first.id);
  }, [ready, messages]);

  useEffect(() => {
    if (!selectedId) return;
    setMessages((current) => {
      const message = current.find((item) => item.id === selectedId);
      if (!message || message.read) return current;
      return current.map((item) => (item.id === selectedId ? { ...item, read: true } : item));
    });
  }, [selectedId]);

  useEffect(() => {
    fetch("/api/sync/status")
      .then((response) => response.json() as Promise<{ configured?: boolean }>)
      .then((body) => setSyncConfigured(Boolean(body.configured)))
      .catch(() => setSyncConfigured(false));
  }, []);

  const visible = useMemo(() => filterMessages(messages, folder, query), [messages, folder, query]);
  const counts = useMemo(() => {
    return Object.fromEntries(FOLDERS.map((item) => [item.id, filterMessages(messages, item.id, "").length])) as Record<FolderId, number>;
  }, [messages]);
  const selected = messages.find((message) => message.id === selectedId) ?? null;
  const summary = useMemo(() => summarise(messages), [messages]);

  function organise() {
    const next = organiseMailbox(messages, settings);
    setMessages(next);
    const result = summarise(next);
    setNotice(
      `Organised ${next.length} emails. ${result.kept} stay in the inbox, ${result.archived} archived, ${result.spam} in spam, and ${result.review} flagged for review. Protected mail was not deleted.`,
    );
  }

  function replaceMessage(id: string, recipe: (message: Message) => Message) {
    setMessages((current) => current.map((message) => (message.id === id ? recipe(message) : message)));
  }

  function removeMessage(id: string) {
    setMessages((current) => current.filter((message) => message.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }

  async function syncMailbox() {
    setBusy(true);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const body = (await response.json()) as { configured?: boolean; emails?: Parameters<typeof addEmails>[1]; message?: string };
      if (!response.ok || !body.emails) {
        setNotice(body.message || "The mailbox could not be read.");
        return;
      }
      if (!body.configured) {
        setSyncConfigured(false);
        setNotice(body.message || "IMAP is not configured yet.");
        return;
      }
      const merged = addEmails(messages, body.emails, settings, { dropSample: true });
      setMessages(merged.messages);
      setUsingSample(merged.messages.some((message) => message.sample));
      setNotice(`Sync added ${merged.added} emails. Rules were applied. Nothing was deleted.`);
      setFolder("inbox");
    } catch {
      setNotice("The mailbox could not be read.");
    } finally {
      setBusy(false);
    }
  }

  function ingestRaw(raws: string[], dropSample: boolean) {
    const parsed = raws.map((raw) => parseEml(raw)).filter((email) => email.fromEmail || email.subject !== "(no subject)");
    if (parsed.length === 0) {
      setNotice("No email could be read. Paste a full message, including the From line, or choose .eml files.");
      return;
    }
    const merged = addEmails(messages, parsed, settings, { dropSample });
    setMessages(merged.messages);
    setUsingSample(merged.messages.some((message) => message.sample));
    setNotice(`Imported ${merged.added} emails and filed them. Protected mail was not deleted.`);
    setPanel(null);
    setFolder("inbox");
    if (merged.messages[0]) setSelectedId(merged.messages[0].id);
  }

  function saveSettings(next: Settings) {
    const cleaned: Settings = {
      ...next,
      ownerEmails: next.ownerEmails.map((item) => item.trim()).filter(Boolean),
      schoolDomains: next.schoolDomains.map((item) => item.trim()).filter(Boolean),
      knownClientEmails: next.knownClientEmails.map((item) => item.trim()).filter(Boolean),
      knownClientDomains: next.knownClientDomains.map((item) => item.trim()).filter(Boolean),
    };
    const filed = organiseMailbox(messages.map((message) => ({ ...message, manualOverride: false })), cleaned);
    setSettings(cleaned);
    setMessages(filed);
    setNotice("Settings saved and the mailbox was filed again. Manually filed mail was included so the new school and client lists take effect.");
    setPanel(null);
  }

  function askSpam(message: Message) {
    const gate = spamDecision(message);
    if (!gate.allowed && message.safetyLock === "uncertain") {
      setDialog({ kind: "spam-uncertain", id: message.id });
      return;
    }
    if (!gate.allowed) {
      setNotice(gate.reason);
      return;
    }
    const moved = moveToSpam(message);
    if (!moved.message) {
      setNotice(moved.error || "This stays out of spam.");
      return;
    }
    replaceMessage(message.id, () => moved.message as Message);
    setNotice("Moved to spam. It is still there if you need to restore it.");
  }

  function askDelete(message: Message) {
    if (message.safetyLock === "school") {
      setDialog({ kind: "school-delete", id: message.id });
      return;
    }
    const gate = deletionDecision(message);
    if (!gate.allowed && !message.spam) {
      setNotice(gate.reason);
      return;
    }
    if (message.spam && !message.safetyLock) {
      setDialog({ kind: "delete-spam", id: message.id });
      return;
    }
    setNotice(gate.reason);
  }

  const groups = ["Attention", "Keep safe", "Filed"] as const;

  return (
    <div className="desk">
      <div className={`folder ${selected ? "is-reading" : ""}`}>
        <header className="mast">
          <div className="brand">
            <span className="seal" aria-hidden="true">{sealText(settings.businessName)}</span>
            <div>
              <p className="eyebrow">Inbox for {settings.ownerName || "you"}</p>
              <h1>Sorter</h1>
            </div>
          </div>
          <p className="mast-note">
            Personal, school, and {settings.businessName || "client"} mail stays protected. Junk is filed, not thrown away.
          </p>
          <div className="mast-actions">
            <button type="button" className="btn btn-primary" onClick={organise}>Organise inbox</button>
            <button type="button" className="btn" onClick={() => void syncMailbox()} disabled={!syncConfigured || busy}>
              {busy ? "Syncing…" : "Sync mailbox"}
            </button>
            <button type="button" className="btn" onClick={() => setPanel("import")}>Import</button>
            <button type="button" className="btn" onClick={() => setPanel("settings")}>Settings</button>
            <button type="button" className="btn btn-quiet" onClick={() => setPanel("rules")}>How filing works</button>
          </div>
        </header>

        {usingSample && (
          <p className="banner">
            This is sample mail so you can see the folders. Import your own messages, or sync from IMAP, when you want the real inbox. Sample messages are marked Sample.
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            <span>{notice}</span>
            <button type="button" className="text-btn" onClick={() => setNotice(null)}>Dismiss</button>
          </p>
        )}

        <div className="workspace">
          <nav className="rail" aria-label="Folders">
            {groups.map((group) => (
              <div key={group} className="rail-group">
                <p className="rail-label">{group}</p>
                {FOLDERS.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="folder-btn"
                    aria-current={folder === item.id ? "page" : undefined}
                    onClick={() => {
                      setFolder(item.id);
                      setQuery("");
                    }}
                  >
                    <span>{item.label}</span>
                    <span className={item.id === "review" && counts[item.id] > 0 && folder !== item.id ? "count count-alert" : "count"}>
                      {counts[item.id]}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            <p className="rail-foot">
              {summary.kept} in the inbox · {summary.protected} protected
            </p>
          </nav>

          <section className="list" aria-label={FOLDERS.find((item) => item.id === folder)?.label ?? "Messages"}>
            <div className="list-head">
              <h2>{FOLDERS.find((item) => item.id === folder)?.label}</h2>
              <label className="search">
                <span className="sr-only">Search this folder</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search sender or subject"
                  type="search"
                />
              </label>
            </div>
            {folder === "spam" && counts.spam > 0 && (
              <div className="list-tools">
                <button type="button" className="btn btn-danger" onClick={() => setDialog({ kind: "empty-spam" })}>
                  Delete all spam
                </button>
              </div>
            )}
            {visible.length === 0 ? (
              <p className="empty">{query ? "Nothing in this folder matches that search." : "Nothing in this folder."}</p>
            ) : (
              <ul className="rows">
                {visible.map((message) => (
                  <li key={message.id}>
                    <button
                      type="button"
                      className={`row ${message.id === selectedId ? "is-selected" : ""} ${message.read ? "" : "is-unread"}`}
                      onClick={() => {
                        setSelectedId(message.id);
                        setNotice(null);
                      }}
                    >
                      <span className={`tab tone-${message.category}`} aria-hidden="true" />
                      <span className="row-main">
                        <span className="row-top">
                          <span className="from">{message.fromName || message.fromEmail}</span>
                          <time dateTime={message.date}>{formatWhen(message.date, "short")}</time>
                        </span>
                        <span className="subject">{message.subject}</span>
                        <span className="row-meta">
                          {message.labels.slice(0, 2).map((label) => (
                            <span className={`chip tone-${message.category}`} key={label}>{label}</span>
                          ))}
                          {message.safetyLock && <span className="chip chip-lock">Protected</span>}
                          {message.sample && <span className="chip">Sample</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <article className="reader" aria-live="polite">
            {selected ? (
              <Reader
                message={selected}
                onBack={() => setSelectedId(null)}
                onArchive={() => replaceMessage(selected.id, archiveMessage)}
                onRestore={() => replaceMessage(selected.id, restoreMessage)}
                onFlag={(flagged) => replaceMessage(selected.id, (message) => flagForReview(message, flagged))}
                onFile={(category) => replaceMessage(selected.id, (message) => fileAs(message, category))}
                onSpam={() => askSpam(selected)}
                onDelete={() => askDelete(selected)}
              />
            ) : (
              <div className="reader-empty">
                <p className="eyebrow">Reading pane</p>
                <h2>Choose a message</h2>
                <p>School, personal, and client mail stays easy to find. Spam is moved aside and can be restored.</p>
              </div>
            )}
          </article>
        </div>
      </div>

      {panel === "settings" && (
        <SettingsDrawer
          settings={settings}
          syncConfigured={syncConfigured}
          usingSample={usingSample}
          onClose={() => setPanel(null)}
          onSave={saveSettings}
          onRemoveSamples={() => setDialog({ kind: "remove-samples" })}
          onRestoreSamples={() => setDialog({ kind: "restore-samples" })}
        />
      )}
      {panel === "import" && (
        <ImportDrawer
          onClose={() => setPanel(null)}
          onImport={(raws, dropSample) => ingestRaw(raws, dropSample)}
        />
      )}
      {panel === "rules" && <RulesDrawer businessName={settings.businessName} onClose={() => setPanel(null)} />}
      {dialog?.kind === "school-delete" && (
        <SchoolDeleteDialog
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const message = messages.find((item) => item.id === dialog.id);
            if (!message) return;
            const gate = deletionDecision(message, { schoolApproved: true, typed: "DELETE" });
            if (!gate.allowed) {
              setNotice(gate.reason);
              return;
            }
            removeMessage(message.id);
            setDialog(null);
            setNotice("The school email was deleted because you specifically approved it.");
          }}
        />
      )}
      {dialog?.kind === "spam-uncertain" && (
        <ConfirmDialog
          title="Move this to spam?"
          body="This was flagged because it might still be important. Confirm you have checked it and it is not personal, school, or a client."
          confirmLabel="Move to spam"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const message = messages.find((item) => item.id === dialog.id);
            if (!message) return;
            const moved = moveToSpam(message, { confirmedUnimportant: true });
            if (!moved.message) {
              setNotice(moved.error || "This stays out of spam.");
              return;
            }
            replaceMessage(message.id, () => moved.message as Message);
            setDialog(null);
            setNotice("Moved to spam after your check. You can restore it.");
          }}
        />
      )}
      {dialog?.kind === "delete-spam" && (
        <ConfirmDialog
          title="Delete this spam?"
          body="This removes the message from the mailbox. Protected mail cannot be deleted this way."
          confirmLabel="Delete spam"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const message = messages.find((item) => item.id === dialog.id);
            if (!message) return;
            const gate = deletionDecision(message, { confirmed: true });
            if (!gate.allowed) {
              setNotice(gate.reason);
              setDialog(null);
              return;
            }
            removeMessage(message.id);
            setDialog(null);
            setNotice("Deleted from spam.");
          }}
        />
      )}
      {dialog?.kind === "empty-spam" && (
        <ConfirmDialog
          title="Delete all spam?"
          body="Protected messages are skipped. Everything else in spam is removed."
          confirmLabel="Delete spam"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            let removed = 0;
            let kept = 0;
            const next = messages.filter((message) => {
              if (!message.spam) return true;
              const gate = deletionDecision(message, { confirmed: true });
              if (!gate.allowed) {
                kept += 1;
                return true;
              }
              removed += 1;
              return false;
            });
            setMessages(next);
            setSelectedId((current) => (current && next.some((message) => message.id === current) ? current : null));
            setDialog(null);
            setNotice(`Deleted ${removed} spam messages.${kept ? ` Kept ${kept} protected messages.` : ""}`);
          }}
        />
      )}
      {dialog?.kind === "restore-samples" && (
        <ConfirmDialog
          title="Restore the sample mailbox?"
          body="This replaces what is currently shown with the sample messages. Mail you imported here is removed from the app only. Your real inbox is not changed."
          confirmLabel="Restore samples"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const seeded = sampleEmails(settings).map((email) => messageFromIncoming(email, settings, { sample: true }));
            setMessages(seeded);
            setUsingSample(true);
            setFolder("inbox");
            setSelectedId(seeded[0]?.id ?? null);
            setDialog(null);
            setPanel(null);
            setNotice("Sample mailbox restored. Nothing was deleted from your real inbox.");
          }}
        />
      )}
      {dialog?.kind === "remove-samples" && (
        <ConfirmDialog
          title="Remove sample mail?"
          body="This removes the demonstration messages. Mail you imported or synced stays."
          confirmLabel="Remove samples"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setMessages((current) => current.filter((message) => !message.sample));
            setUsingSample(false);
            setDialog(null);
            setPanel(null);
            setNotice("Sample mail removed.");
          }}
        />
      )}
    </div>
  );
}

function Reader({
  message,
  onBack,
  onArchive,
  onRestore,
  onFlag,
  onFile,
  onSpam,
  onDelete,
}: {
  message: Message;
  onBack: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onFlag: (flagged: boolean) => void;
  onFile: (category: Category) => void;
  onSpam: () => void;
  onDelete: () => void;
}) {
  const protection = lockCopy(message);
  const away = message.spam || message.archived;
  return (
    <div className="letter">
      <button type="button" className="back" onClick={onBack}>Back to the list</button>
      <p className="eyebrow">{CATEGORY_NAME[message.category]}{message.priority === "high" ? " · High priority" : ""}</p>
      <h2>{message.subject}</h2>
      <p className="correspondent">
        <strong>{message.fromName || message.fromEmail}</strong>
        <span>{message.fromEmail}</span>
      </p>
      <p className="correspondent quiet">
        <span>To {message.toEmail || "you"}</span>
        <time dateTime={message.date}>{formatWhen(message.date)} UK</time>
      </p>
      <div className={`filing tone-${message.category}`}>
        <div className="filing-top">
          {message.labels.map((label) => (
            <span className="chip" key={label}>{label}</span>
          ))}
          {message.safetyLock && <span className="chip chip-lock">Protected</span>}
          {message.sample && <span className="chip">Sample</span>}
        </div>
        {protection && <p className="protection">{protection}</p>}
        <ul className="reasons">
          {message.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      {message.review && message.labels.includes("SCHOOL") && (
        <p className="caution">Check the sender before you open any link. This was kept because it might be school mail.</p>
      )}
      {message.review && message.labels.includes("NEW CLIENT LEAD") && (
        <p className="caution">This might be a new customer, but part of the message looks unsafe. It was kept for you to check.</p>
      )}
      <div className="actions">
        {away ? (
          <button type="button" className="btn btn-primary" onClick={onRestore}>Return to inbox</button>
        ) : (
          <button type="button" className="btn" onClick={onArchive}>Archive</button>
        )}
        <button type="button" className="btn" onClick={() => onFlag(!message.review)}>
          {message.review ? "Clear review flag" : "Flag for review"}
        </button>
        <button type="button" className="btn" onClick={onSpam}>Move to spam</button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        <label className="file-as">
          File as
          <select
            value={message.category === "spam" ? "review" : message.category}
            onChange={(event) => onFile(event.target.value as Category)}
          >
            {FILE_CATEGORIES.map((category) => (
              <option value={category} key={category}>{CATEGORY_NAME[category]}</option>
            ))}
          </select>
        </label>
      </div>
      <pre className="body">{message.bodyText}</pre>
    </div>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="drawer-back" onMouseDown={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-top">
          <h2>{title}</h2>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function SettingsDrawer({
  settings,
  syncConfigured,
  usingSample,
  onClose,
  onSave,
  onRemoveSamples,
  onRestoreSamples,
}: {
  settings: Settings;
  syncConfigured: boolean;
  usingSample: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  onRemoveSamples: () => void;
  onRestoreSamples: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  function setList(key: "ownerEmails" | "schoolDomains" | "knownClientEmails" | "knownClientDomains", value: string) {
    setDraft({ ...draft, [key]: lines(value) });
  }
  return (
    <Drawer title="Settings" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <label>
          Your name
          <input value={draft.ownerName} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} />
        </label>
        <label>
          Your email addresses
          <textarea value={draft.ownerEmails.join("\n")} onChange={(event) => setList("ownerEmails", event.target.value)} rows={3} />
        </label>
        <label>
          Business name
          <input value={draft.businessName} onChange={(event) => setDraft({ ...draft, businessName: event.target.value })} />
        </label>
        <label>
          School domains
          <textarea value={draft.schoolDomains.join("\n")} onChange={(event) => setList("schoolDomains", event.target.value)} rows={3} />
        </label>
        <label>
          Known client emails
          <textarea value={draft.knownClientEmails.join("\n")} onChange={(event) => setList("knownClientEmails", event.target.value)} rows={3} />
        </label>
        <label>
          Known client domains
          <textarea value={draft.knownClientDomains.join("\n")} onChange={(event) => setList("knownClientDomains", event.target.value)} rows={3} />
        </label>
        <p className="hint">
          {syncConfigured
            ? "IMAP sync is configured on this computer. Use Sync mailbox to read the inbox."
            : "To sync, add IMAP_HOST, IMAP_USER, and IMAP_PASSWORD to a .env file beside the app, then restart the dev server. The password is never typed into this page."}
        </p>
        <p className="hint">Messages stay in this browser. Saving settings files the mailbox again.</p>
        <div className="actions">
          <button type="submit" className="btn btn-primary">Save and refile</button>
          {usingSample && (
            <button type="button" className="btn" onClick={onRemoveSamples}>Remove sample mail</button>
          )}
          <button type="button" className="btn" onClick={onRestoreSamples}>Restore sample mailbox</button>
        </div>
      </form>
    </Drawer>
  );
}

function ImportDrawer({ onClose, onImport }: { onClose: () => void; onImport: (raws: string[], dropSample: boolean) => void }) {
  const [paste, setPaste] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [dropSample, setDropSample] = useState(true);

  async function takeFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const texts = await Promise.all([...list].map((file) => file.text()));
    setFiles(texts);
  }

  return (
    <Drawer title="Import email" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const raws = [...files, paste].map((item) => item.trim()).filter(Boolean);
          onImport(raws, dropSample);
        }}
      >
        <label
          className="drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void takeFiles(event.dataTransfer.files);
          }}
        >
          Choose .eml files
          <input
            type="file"
            accept=".eml,message/rfc822,text/plain"
            multiple
            onChange={(event) => void takeFiles(event.target.files)}
          />
          <span className="hint">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} ready` : "Or drop them here"}</span>
        </label>
        <label>
          Or paste one raw email
          <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={8} placeholder={"From: Tom <tom@harbourcafe.example>\nSubject: Quote for a website\n\nI would like a quote."} />
        </label>
        <label className="check">
          <input type="checkbox" checked={dropSample} onChange={(event) => setDropSample(event.target.checked)} />
          Remove sample mail when this import is added
        </label>
        <button type="submit" className="btn btn-primary">Add to mailbox</button>
      </form>
    </Drawer>
  );
}

function RulesDrawer({ businessName, onClose }: { businessName: string; onClose: () => void }) {
  return (
    <Drawer title="How filing works" onClose={onClose}>
      <div className="stack rules">
        <section>
          <h3>High priority</h3>
          <p>Mail from you, about you, from school, or from a client stays in the inbox and is marked important.</p>
          <p>Someone asking to buy from {businessName || "the business"} is marked <strong>NEW CLIENT LEAD</strong>. A saved customer is marked <strong>CLIENT</strong>.</p>
        </section>
        <section>
          <h3>Other folders</h3>
          <p>Finance and account notices stay in the inbox. Receipts, subscriptions, social notifications, and newsletters are archived so the inbox stays clear. They are still in their folders.</p>
        </section>
        <section>
          <h3>Spam and uncertainty</h3>
          <p>Obvious spam and unwanted advertising go to spam. They are not deleted until you confirm it.</p>
          <p>If a message might be school, a client, or a scam dressed up as one of those, it is flagged for review and kept.</p>
        </section>
        <section>
          <h3>What is never removed automatically</h3>
          <p>Nothing from you, your school, a teacher, a client, or a possible client is deleted. School mail can be deleted only when you specifically approve that one message.</p>
        </section>
      </div>
    </Drawer>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="drawer-back" onMouseDown={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="confirm-title">{title}</h2>
        <p>{body}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function SchoolDeleteDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const [approved, setApproved] = useState(false);
  const [typed, setTyped] = useState("");
  const ready = approved && typed === "DELETE";
  return (
    <div className="drawer-back" onMouseDown={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="school-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="school-title">Delete this school email?</h2>
        <p>School mail is kept unless you specifically approve deletion. This cannot be undone.</p>
        <label className="check">
          <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
          <span>I specifically approve deleting this school email</span>
        </label>
        <label>
          Type DELETE to confirm
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>Keep it</button>
          <button type="button" className="btn btn-danger" disabled={!ready} onClick={onConfirm}>Delete school email</button>
        </div>
      </div>
    </div>
  );
}
