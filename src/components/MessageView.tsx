import { useEffect, useState } from "react";
import { CATEGORY_LABEL } from "../domain/folders";
import { removalBlockReason } from "../domain/safety";
import type { Category, StoredEmail } from "../domain/types";
import { formatStamp } from "../format";

interface MessageViewProps {
  email: StoredEmail | null;
  narrow: boolean;
  onBack: () => void;
  onCategory: (id: string, category: Category) => void;
  onMove: (id: string, folder: StoredEmail["folder"]) => void;
  onImportant: (id: string, important: boolean) => void;
  onFlag: (id: string, flagged: boolean) => void;
  onRelease: (id: string) => void;
  onTrash: (id: string, approved: boolean) => void;
  onSpam: (id: string, approved: boolean) => void;
  onDeleteForever: (id: string, approved: boolean) => void;
}

export function MessageView(props: MessageViewProps) {
  const { email } = props;
  if (!email) {
    return (
      <section className="detail empty-detail">
        <p>Select a message. School, personal, and client mail stays protected.</p>
      </section>
    );
  }
  return <MessageDetail {...props} email={email} />;
}

function MessageDetail({
  email,
  narrow,
  onBack,
  onCategory,
  onMove,
  onImportant,
  onFlag,
  onRelease,
  onTrash,
  onSpam,
  onDeleteForever,
}: MessageViewProps & { email: StoredEmail }) {
  const [pending, setPending] = useState<"trash" | "spam" | "forever" | null>(null);
  const [approved, setApproved] = useState(false);
  const block = pending ? removalBlockReason(email, approved) : null;

  useEffect(() => {
    setPending(null);
    setApproved(false);
  }, [email.id]);

  function ask(action: "trash" | "spam" | "forever") {
    setPending(action);
    setApproved(false);
  }

  function confirm() {
    if (!pending || removalBlockReason(email, approved)) return;
    if (pending === "trash") onTrash(email.id, approved);
    if (pending === "spam") onSpam(email.id, approved);
    if (pending === "forever") onDeleteForever(email.id, approved);
    setPending(null);
  }

  return (
    <article className="detail">
      {narrow ? (
        <button type="button" className="back" onClick={onBack}>
          Back to the list
        </button>
      ) : null}
      <header className="detail-head">
        <div className="row-meta">
          {email.badge ? (
            <span className={`badge ${badgeClass(email.badge)}`}>{email.badge}</span>
          ) : email.category ? (
            <span className="badge plain">{CATEGORY_LABEL[email.category]}</span>
          ) : (
            <span className="badge plain">Unfiled</span>
          )}
          {email.important ? <span className="badge plain">Important</span> : null}
          {email.source === "sample" ? <span className="badge plain">Sample</span> : null}
        </div>
        <h2>{email.subject}</h2>
        <p className="meta">
          <strong>{email.fromName || "Unknown sender"}</strong>
          <span>{email.fromEmail}</span>
          <span>{formatStamp(email.date)}</span>
        </p>
      </header>
      {email.protected || email.flaggedForReview ? (
        <p className="safety">
          {email.flaggedForReview
            ? "Flagged for your review. It stays in the inbox and will not be deleted unless you specifically approve it."
            : "Protected. Personal, school, and client mail is kept easy to find and is not deleted unless you specifically approve it."}
        </p>
      ) : null}
      {email.reasons.length > 0 ? (
        <div className="reasons">
          <h3>Why it was filed this way</h3>
          <ul>
            {email.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {email.confidence ? <p className="confidence">{email.confidence} confidence</p> : null}
        </div>
      ) : (
        <p className="safety">Not filed yet. Organise inbox to label it. Uncertain mail is kept.</p>
      )}
      <div className="body">{email.body}</div>
      <div className="actions">
        <label>
          File as
          <select
            value={email.category ?? ""}
            onChange={(event) => {
              const value = event.target.value as Category;
              if (!value || value === email.category) return;
              if (value === "spam") {
                ask("spam");
                return;
              }
              onCategory(email.id, value);
            }}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {Object.entries(CATEGORY_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onImportant(email.id, !email.important)}>
          {email.important ? "Clear important" : "Mark important"}
        </button>
        <button type="button" onClick={() => onFlag(email.id, !email.flaggedForReview)}>
          {email.flaggedForReview ? "Clear review flag" : "Flag for review"}
        </button>
        {email.folder !== "inbox" ? (
          <button type="button" onClick={() => onMove(email.id, "inbox")}>
            Move to inbox
          </button>
        ) : (
          <button type="button" onClick={() => onMove(email.id, "archive")}>
            Archive
          </button>
        )}
        {email.userOverride ? (
          <button type="button" onClick={() => onRelease(email.id)}>
            Let organise decide
          </button>
        ) : null}
        {email.folder !== "spam" ? (
          <button type="button" onClick={() => ask("spam")}>
            Move to spam
          </button>
        ) : null}
        {email.folder !== "trash" ? (
          <button type="button" className="danger" onClick={() => ask("trash")}>
            Delete
          </button>
        ) : (
          <button type="button" className="danger" onClick={() => ask("forever")}>
            Delete forever
          </button>
        )}
      </div>
      {pending ? (
        <div className="confirm" role="group" aria-label="Confirm removal">
          <p>
            {pending === "spam"
              ? "Move this message to spam? It is not deleted."
              : pending === "forever"
                ? "Delete this message forever? This cannot be undone."
                : "Move this message to trash? You can still restore it from Trash."}
          </p>
          {removalBlockReason(email, false) ? (
            <label className="approve">
              <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
              I specifically approve deleting this email
            </label>
          ) : null}
          {block ? <p className="block">{block}</p> : null}
          <div className="confirm-actions">
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className="danger" disabled={Boolean(block)} onClick={confirm}>
              {block
                ? "Approval needed"
                : pending === "spam"
                  ? "Move to spam"
                  : pending === "forever"
                    ? "Delete forever"
                    : "Move to trash"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function badgeClass(badge: string): string {
  if (badge === "NEW CLIENT LEAD") return "lead";
  if (badge === "CLIENT") return "client";
  if (badge === "SCHOOL") return "school";
  if (badge === "PERSONAL") return "personal";
  if (badge === "REVIEW") return "review";
  return "plain";
}
