import { useState, type ReactNode } from "react";
import type { Profile } from "../domain/types";
import { normaliseProfile } from "../domain/profile";
import { parseEml, parseMailJson, type ParsedMail } from "../domain/parseMail";

interface SettingsProps {
  profile: Profile;
  onClose: () => void;
  onSave: (profile: Profile) => void;
}

export function SettingsDialog({ profile, onClose, onSave }: SettingsProps) {
  const [draft, setDraft] = useState<Profile>(profile);

  function save() {
    onSave(normaliseProfile(draft));
  }

  return (
    <Modal titleId="settings-title" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <header>
          <h2 id="settings-title">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings">
            Close
          </button>
        </header>
        <p className="hint">
          These details decide what counts as you, your school, and a client. Organise again after saving.
        </p>
        <label>
          Your name
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          Your email addresses
          <textarea
            value={draft.emails.join("\n")}
            onChange={(event) => setDraft({ ...draft, emails: lines(event.target.value) })}
            rows={3}
          />
        </label>
        <label>
          Business name
          <input
            value={draft.businessName}
            onChange={(event) => setDraft({ ...draft, businessName: event.target.value })}
          />
        </label>
        <label>
          Business names to watch for
          <textarea
            value={draft.businessAliases.join("\n")}
            onChange={(event) => setDraft({ ...draft, businessAliases: lines(event.target.value) })}
            rows={3}
          />
        </label>
        <label>
          School domains
          <textarea
            value={draft.schoolDomains.join("\n")}
            onChange={(event) => setDraft({ ...draft, schoolDomains: lines(event.target.value) })}
            rows={3}
          />
        </label>
        <fieldset>
          <legend>Existing clients</legend>
          {draft.knownClients.map((client, index) => (
            <div key={`${client.email}-${index}`} className="client-row">
              <input
                aria-label="Client name"
                value={client.name}
                onChange={(event) => updateClient(index, { ...client, name: event.target.value })}
              />
              <input
                aria-label="Client email"
                value={client.email}
                onChange={(event) => updateClient(index, { ...client, email: event.target.value })}
              />
              <button type="button" onClick={() => removeClient(index)}>
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setDraft({ ...draft, knownClients: [...draft.knownClients, { name: "", email: "" }] })
            }
          >
            Add client
          </button>
        </fieldset>
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save settings
          </button>
        </div>
      </form>
    </Modal>
  );

  function updateClient(index: number, next: Profile["knownClients"][number]) {
    setDraft({
      ...draft,
      knownClients: draft.knownClients.map((client, clientIndex) => (clientIndex === index ? next : client)),
    });
  }

  function removeClient(index: number) {
    setDraft({ ...draft, knownClients: draft.knownClients.filter((_, clientIndex) => clientIndex !== index) });
  }
}

interface ImportProps {
  onClose: () => void;
  onAdd: (messages: ParsedMail[]) => void;
}

export function ImportDialog({ onClose, onAdd }: ImportProps) {
  const [error, setError] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      const parsed: ParsedMail[] = [];
      for (const file of files) {
        const text = await file.text();
        if (file.name.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
          parsed.push(...parseMailJson(text));
        } else {
          parsed.push(parseEml(text));
        }
      }
      onAdd(parsed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file could not be read.");
    }
  }

  return (
    <Modal titleId="import-title" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!fromEmail.includes("@")) {
            setError("Enter the sender's email address.");
            return;
          }
          onAdd([{ fromName, fromEmail, to: [], subject: subject || "(no subject)", body, date: new Date().toISOString() }]);
        }}
      >
        <header>
          <h2 id="import-title">Add mail</h2>
          <button type="button" onClick={onClose} aria-label="Close add mail">
            Close
          </button>
        </header>
        <p className="hint">
          Import .eml or JSON, or paste one message. New mail stays in the inbox until you organise it.
        </p>
        <label>
          Import files
          <input
            type="file"
            accept=".eml,.json,message/rfc822,application/json"
            multiple
            onChange={(event) => void onFiles(event.target.files)}
          />
        </label>
        <label>
          From name
          <input value={fromName} onChange={(event) => setFromName(event.target.value)} />
        </label>
        <label>
          From email
          <input value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} type="email" />
        </label>
        <label>
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <label>
          Message
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} />
        </label>
        {error ? <p className="block">{error}</p> : null}
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Add to inbox
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RulesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal titleId="rules-title" onClose={onClose}>
      <div>
        <header>
          <h2 id="rules-title">How filing works</h2>
          <button type="button" onClick={onClose} aria-label="Close filing rules">
            Close
          </button>
        </header>
        <ul className="rules">
          <li>Mail from you is Personal, kept in the inbox, and protected.</li>
          <li>School mail, including teachers, homework, exams, timetables, and announcements, stays marked School.</li>
          <li>People already saved as customers are marked CLIENT.</li>
          <li>Someone asking about buying from RS Digital Services is marked NEW CLIENT LEAD.</li>
          <li>Receipts, finance, accounts, subscriptions, social notifications, and newsletters are labelled and archived.</li>
          <li>Obvious spam and unwanted advertising move to Spam. They are not deleted.</li>
          <li>If a message might matter but looks suspicious, it is flagged for review and left in the inbox.</li>
          <li>Personal, school, client, lead, and uncertain mail cannot be deleted unless you specifically approve it.</li>
        </ul>
        <div className="confirm-actions">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
