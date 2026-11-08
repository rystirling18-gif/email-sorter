import { classify } from "./classifier";
import type { Category, Classification, IncomingEmail, MailFolder, OrganiseReport, Profile, StoredEmail } from "./types";

export function applyClassification(email: StoredEmail, classification: Classification): StoredEmail {
  const folder = classification.action === "archive" ? "archive" : classification.action === "spam" ? "spam" : "inbox";
  return {
    ...email,
    folder,
    important: classification.important,
    protected: classification.protected,
    flaggedForReview: classification.action === "review",
    category: classification.category,
    badge: classification.badge,
    reasons: classification.reasons,
    confidence: classification.confidence,
  };
}

export function organiseMailbox(
  emails: StoredEmail[],
  profile: Profile,
  at = new Date().toISOString(),
): { emails: StoredEmail[]; report: OrganiseReport } {
  let kept = 0;
  let archived = 0;
  let spam = 0;
  let review = 0;
  let skipped = 0;

  const next = emails.map((email) => {
    if (email.folder === "trash" || email.userOverride) {
      if (email.userOverride) skipped += 1;
      return email;
    }
    const updated = applyClassification(email, classify(toIncoming(email), profile));
    if (updated.folder === "spam") spam += 1;
    else if (updated.folder === "archive") archived += 1;
    else if (updated.flaggedForReview) review += 1;
    else kept += 1;
    return updated;
  });

  return {
    emails: next,
    report: {
      at,
      kept,
      archived,
      spam,
      review,
      skipped,
      deleted: 0,
      leads: next
        .filter((email) => email.category === "new_client_lead" && email.folder !== "trash")
        .map((email) => email.subject),
      school: next.filter((email) => email.category === "school" && email.folder !== "trash").length,
    },
  };
}

const MANUAL: Record<Category, Pick<Classification, "action" | "badge" | "important" | "protected" | "confidence">> = {
  personal: { action: "keep", badge: "PERSONAL", important: true, protected: true, confidence: "high" },
  school: { action: "keep", badge: "SCHOOL", important: true, protected: true, confidence: "high" },
  client: { action: "keep", badge: "CLIENT", important: true, protected: true, confidence: "high" },
  new_client_lead: { action: "keep", badge: "NEW CLIENT LEAD", important: true, protected: true, confidence: "high" },
  review: { action: "review", badge: "REVIEW", important: true, protected: true, confidence: "medium" },
  finance: { action: "archive", badge: null, important: false, protected: false, confidence: "high" },
  accounts: { action: "archive", badge: null, important: false, protected: false, confidence: "high" },
  subscriptions: { action: "archive", badge: null, important: false, protected: false, confidence: "high" },
  receipts: { action: "archive", badge: null, important: false, protected: false, confidence: "high" },
  social_media: { action: "archive", badge: null, important: false, protected: false, confidence: "high" },
  newsletters: { action: "archive", badge: null, important: false, protected: false, confidence: "high" },
  spam: { action: "spam", badge: null, important: false, protected: false, confidence: "high" },
};

export function applyManualCategory(email: StoredEmail, category: Category): StoredEmail {
  const choice = MANUAL[category];
  return {
    ...applyClassification(email, {
      category,
      reasons: ["You filed this yourself. Organise will leave it here until you hand it back."],
      ...choice,
    }),
    userOverride: true,
  };
}

export function moveMail(email: StoredEmail, folder: MailFolder): StoredEmail {
  return {
    ...email,
    folder,
    userOverride: true,
    flaggedForReview: folder === "spam" ? false : email.flaggedForReview,
  };
}

export function toIncoming(email: StoredEmail): IncomingEmail {
  return {
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    to: email.to,
    subject: email.subject,
    body: email.body,
  };
}

export function emailInView(email: StoredEmail, view: string): boolean {
  if (view === "trash") return email.folder === "trash";
  if (email.folder === "trash") return false;
  if (view === "inbox") return email.folder === "inbox";
  if (view === "archive") return email.folder === "archive";
  if (view === "spam") return email.folder === "spam";
  if (view === "review") return email.flaggedForReview && email.folder !== "spam";
  if (view === "important") return email.important && email.folder !== "spam";
  return email.category === view;
}
