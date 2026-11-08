import { CATEGORY_LABEL, FOLDERS } from "../domain/folders";
import type { Category, SidebarFolder, StoredEmail } from "../domain/types";
import { formatWhen, snippet } from "../format";

interface MessageListProps {
  view: SidebarFolder;
  emails: StoredEmail[];
  selectedId: string | null;
  query: string;
  waiting: number;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onOrganise: () => void;
}

export function MessageList({
  view,
  emails,
  selectedId,
  query,
  waiting,
  onQuery,
  onSelect,
  onOrganise,
}: MessageListProps) {
  const title = FOLDERS.find((folder) => folder.id === view)?.label ?? "Inbox";
  return (
    <section className="list" aria-label={title}>
      <header className="list-head">
        <div>
          <h2>{title}</h2>
          <p>{emails.length === 1 ? "1 message" : `${emails.length} messages`}</p>
        </div>
        <button type="button" className="primary" onClick={onOrganise}>
          {waiting > 0 ? "Organise inbox" : "Organise again"}
        </button>
      </header>
      <label className="search">
        <span className="sr">Search messages</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search sender, subject, or message"
          type="search"
        />
      </label>
      {emails.length === 0 ? (
        <p className="empty">Nothing in this folder.</p>
      ) : (
        <ul className="rows">
          {emails.map((email) => (
            <li key={email.id}>
              <button
                type="button"
                className={email.id === selectedId ? "row selected" : "row"}
                onClick={() => onSelect(email.id)}
              >
                <span className="row-top">
                  <span className={email.read ? "sender" : "sender unread"}>{email.fromName || email.fromEmail}</span>
                  <span className="when">{formatWhen(email.date)}</span>
                </span>
                <span className={email.read ? "subject" : "subject unread"}>{email.subject}</span>
                <span className="preview">{snippet(email.body)}</span>
                <span className="row-meta">
                  {email.badge ? (
                    <span className={`badge ${badgeClass(email.badge)}`}>{email.badge}</span>
                  ) : email.category ? (
                    <span className="badge plain">{categoryName(email.category)}</span>
                  ) : (
                    <span className="badge plain">Unfiled</span>
                  )}
                  {email.source === "sample" ? <span className="badge plain">Sample</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function categoryName(category: Category): string {
  return CATEGORY_LABEL[category];
}

function badgeClass(badge: string): string {
  if (badge === "NEW CLIENT LEAD") return "lead";
  if (badge === "CLIENT") return "client";
  if (badge === "SCHOOL") return "school";
  if (badge === "PERSONAL") return "personal";
  if (badge === "REVIEW") return "review";
  return "plain";
}
