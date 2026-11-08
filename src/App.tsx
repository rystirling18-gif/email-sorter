import { useEffect, useMemo, useState } from "react";
import { ImportDialog, RulesDialog, SettingsDialog } from "./components/Dialogs";
import { MessageList } from "./components/MessageList";
import { MessageView } from "./components/MessageView";
import { Sidebar } from "./components/Sidebar";
import { applyManualCategory, emailInView, moveMail, organiseMailbox } from "./domain/organise";
import type { ParsedMail } from "./domain/parseMail";
import { removalBlockReason } from "./domain/safety";
import type { Category, MailFolder, SidebarFolder, StoredEmail } from "./domain/types";
import { formatStamp } from "./format";
import { freshState, loadState, saveState, type AppState } from "./storage";

type Dialog = "settings" | "import" | "rules" | null;

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<SidebarFolder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [narrow, setNarrow] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 960px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const waiting = state.emails.filter((email) => email.folder !== "trash" && email.category === null).length;
  const sampleCount = state.emails.filter((email) => email.source === "sample").length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.emails
      .filter((email) => emailInView(email, view))
      .filter((email) => {
        if (!needle) return true;
        return `${email.fromName} ${email.fromEmail} ${email.subject} ${email.body}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.emails, view, query]);

  const selected = state.emails.find((email) => email.id === selectedId) ?? null;
  const showList = !narrow || !selected;
  const showDetail = !narrow || Boolean(selected);
  const showSidebar = !narrow || !selected;

  function update(id: string, recipe: (email: StoredEmail) => StoredEmail) {
    setState((current) => ({
      ...current,
      emails: current.emails.map((email) => (email.id === id ? recipe(email) : email)),
    }));
  }

  function organise() {
    const result = organiseMailbox(state.emails, state.profile);
    const nextVisible = result.emails
      .filter((email) => emailInView(email, "inbox"))
      .sort((a, b) => b.date.localeCompare(a.date));
    const selected = nextVisible[0]?.id ?? null;
    setState({
      ...state,
      report: result.report,
      emails: result.emails.map((email) => (email.id === selected ? { ...email, read: true } : email)),
    });
    setView("inbox");
    setShowReport(true);
    setSelectedId(selected);
  }

  function select(id: string) {
    setSelectedId(id);
    update(id, (email) => ({ ...email, read: true }));
  }

  function chooseView(next: SidebarFolder) {
    const rows = state.emails
      .filter((email) => emailInView(email, next))
      .sort((a, b) => b.date.localeCompare(a.date));
    const id = rows[0]?.id ?? null;
    setView(next);
    setQuery("");
    setSelectedId(id);
    if (id) update(id, (email) => ({ ...email, read: true }));
  }

  function guarded(id: string, approved: boolean, recipe: (email: StoredEmail) => StoredEmail) {
    const email = state.emails.find((item) => item.id === id);
    if (!email || removalBlockReason(email, approved)) return;
    const remaining = visible.filter((item) => item.id !== id);
    update(id, recipe);
    if (!emailInView(recipe(email), view)) setSelectedId(remaining[0]?.id ?? null);
  }

  function addMessages(messages: ParsedMail[]) {
    const now = new Date().toISOString();
    const added: StoredEmail[] = messages.map((message) => ({
      id: crypto.randomUUID(),
      fromName: message.fromName,
      fromEmail: message.fromEmail,
      to: message.to,
      subject: message.subject,
      body: message.body,
      date: message.date && !Number.isNaN(new Date(message.date).getTime()) ? new Date(message.date).toISOString() : now,
      folder: "inbox",
      read: false,
      important: false,
      protected: false,
      flaggedForReview: false,
      category: null,
      badge: null,
      reasons: [],
      confidence: null,
      userOverride: false,
      source: "import",
    }));
    setState((current) => ({ ...current, emails: [...added, ...current.emails] }));
    setView("inbox");
    setSelectedId(added[0]?.id ?? null);
    setDialog(null);
  }

  return (
    <div className="app">
      {showSidebar ? (
        <Sidebar
          emails={state.emails}
          view={view}
          onView={chooseView}
          onImport={() => setDialog("import")}
          onSettings={() => setDialog("settings")}
          onRules={() => setDialog("rules")}
          onRestore={() => {
            if (window.confirm("Replace the current mailbox with the sample messages?")) {
              setState(freshState());
              setView("inbox");
              setSelectedId(null);
              setShowReport(false);
              setQuery("");
            }
          }}
        />
      ) : null}
      <main className="main">
        {sampleCount > 0 ? (
          <p className="banner">
            {sampleCount === state.emails.length
              ? "Sample mailbox. This is not your live Gmail, Outlook, or other inbox."
              : "Sample messages are still mixed in with mail you added."}{" "}
            Import an .eml or JSON export, then organise it with the same rules.
          </p>
        ) : null}
        {showReport && state.report ? (
          <div className="report" role="status">
            <div>
              <p>
                Organised {formatStamp(state.report.at)}. {state.report.kept} kept in the inbox, {state.report.review}{" "}
                flagged for review, {state.report.archived} archived, {state.report.spam} moved to spam.
              </p>
              <p>
                Nothing was deleted. {state.report.school} school {state.report.school === 1 ? "email is" : "emails are"}{" "}
                marked, and {state.report.leads.length}{" "}
                {state.report.leads.length === 1 ? "new client lead is" : "new client leads are"} saved.
              </p>
            </div>
            <button type="button" onClick={() => setShowReport(false)}>
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="panes">
          {showList ? (
            <MessageList
              view={view}
              emails={visible}
              selectedId={selectedId}
              query={query}
              waiting={waiting}
              onQuery={setQuery}
              onSelect={select}
              onOrganise={organise}
            />
          ) : null}
          {showDetail ? (
            <MessageView
              email={selected}
              narrow={narrow}
              onBack={() => setSelectedId(null)}
              onCategory={(id, category: Category) => update(id, (email) => applyManualCategory(email, category))}
              onMove={(id, folder: MailFolder) => update(id, (email) => moveMail(email, folder))}
              onImportant={(id, important) => update(id, (email) => ({ ...email, important, userOverride: true }))}
              onFlag={(id, flagged) =>
                update(id, (email) => ({
                  ...email,
                  flaggedForReview: flagged,
                  protected: flagged ? true : email.protected,
                  userOverride: true,
                }))
              }
              onRelease={(id) => update(id, (email) => ({ ...email, userOverride: false }))}
              onTrash={(id, approved) => guarded(id, approved, (email) => moveMail(email, "trash"))}
              onSpam={(id, approved) => guarded(id, approved, (email) => applyManualCategory(email, "spam"))}
              onDeleteForever={(id, approved) => {
                const email = state.emails.find((item) => item.id === id);
                if (!email || removalBlockReason(email, approved)) return;
                setState((current) => ({ ...current, emails: current.emails.filter((item) => item.id !== id) }));
                setSelectedId(null);
              }}
            />
          ) : null}
        </div>
      </main>
      {dialog === "settings" ? (
        <SettingsDialog
          profile={state.profile}
          onClose={() => setDialog(null)}
          onSave={(profile) => {
            setState((current) => ({ ...current, profile }));
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "import" ? <ImportDialog onClose={() => setDialog(null)} onAdd={addMessages} /> : null}
      {dialog === "rules" ? <RulesDialog onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
