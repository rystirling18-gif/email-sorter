import type { Category, Message, SafetyLock } from "../types";
import { deletionDecision, spamDecision } from "./safety";
import { unique } from "./text";

const LOCK_RANK: Record<Exclude<SafetyLock, null>, number> = {
  self: 6,
  client: 5,
  lead: 5,
  school: 4,
  personal: 4,
  uncertain: 3,
};

const CATEGORY_LOCK: Record<Category, SafetyLock> = {
  personal: "personal",
  school: "school",
  client: "client",
  new_client_lead: "lead",
  important: "uncertain",
  review: "uncertain",
  finance: null,
  accounts: null,
  subscriptions: null,
  receipts: null,
  social: null,
  newsletters: null,
  spam: null,
};

const CATEGORY_LABEL: Record<Category, string> = {
  personal: "PERSONAL",
  school: "SCHOOL",
  client: "CLIENT",
  new_client_lead: "NEW CLIENT LEAD",
  important: "IMPORTANT",
  review: "NEEDS REVIEW",
  finance: "FINANCE",
  accounts: "ACCOUNTS",
  subscriptions: "SUBSCRIPTIONS",
  receipts: "RECEIPTS",
  social: "SOCIAL MEDIA",
  newsletters: "NEWSLETTERS",
  spam: "SPAM",
};

function keepStrongerLock(current: SafetyLock, next: SafetyLock): SafetyLock {
  if (!current) return next;
  if (!next) return current;
  return LOCK_RANK[current] > LOCK_RANK[next] ? current : next;
}

export function archiveMessage(message: Message): Message {
  return { ...message, archived: true, inInbox: false, spam: false };
}

export function restoreMessage(message: Message): Message {
  if (message.spam) {
    return {
      ...message,
      spam: false,
      archived: false,
      inInbox: true,
      review: true,
      manualOverride: true,
      safetyLock: message.safetyLock ?? "uncertain",
      category: message.category === "spam" ? "review" : message.category,
      labels: unique([...message.labels.filter((label) => label !== "SPAM"), "NEEDS REVIEW"]),
      reasons: [...message.reasons, "You restored this from spam, so it stays in the inbox for review."],
    };
  }
  return { ...message, archived: false, inInbox: true, spam: false };
}

export function moveToSpam(
  message: Message,
  options: { confirmedUnimportant?: boolean } = {},
): { message?: Message; error?: string } {
  const gate = spamDecision(message, options);
  if (!gate.allowed) return { error: gate.reason };
  return {
    message: {
      ...message,
      spam: true,
      inInbox: false,
      archived: false,
      review: false,
      manualOverride: true,
      safetyLock: message.safetyLock === "uncertain" ? null : message.safetyLock,
      category: "spam",
      labels: ["SPAM"],
      important: false,
      reasons: [...message.reasons, gate.reason],
    },
  };
}

export function deleteMessage(
  message: Message,
  options: { schoolApproved?: boolean; typed?: string; confirmed?: boolean } = {},
): { ok: boolean; error?: string } {
  const gate = deletionDecision(message, options);
  if (!gate.allowed) return { ok: false, error: gate.reason };
  return { ok: true };
}

function lockLabel(lock: SafetyLock): string | null {
  switch (lock) {
    case "self":
    case "personal":
      return "PERSONAL";
    case "school":
      return "SCHOOL";
    case "client":
      return "CLIENT";
    case "lead":
      return "NEW CLIENT LEAD";
    default:
      return null;
  }
}

export function flagForReview(message: Message, flagged: boolean): Message {
  return {
    ...message,
    review: flagged,
    manualOverride: true,
    spam: false,
    inInbox: true,
    archived: flagged ? false : message.archived,
    safetyLock: message.safetyLock,
  };
}

export function fileAs(message: Message, category: Category): Message {
  const nextLock = keepStrongerLock(message.safetyLock, CATEGORY_LOCK[category]);
  const kept = lockLabel(nextLock);
  return {
    ...message,
    category,
    labels: unique([CATEGORY_LABEL[category], ...(kept ? [kept] : []), ...(message.important ? ["IMPORTANT"] : [])]),
    safetyLock: nextLock,
    manualOverride: true,
    spam: false,
    inInbox: true,
    archived: false,
    review: category === "review",
    important:
      message.important ||
      ["personal", "school", "client", "new_client_lead", "important", "finance", "accounts", "review"].includes(category),
    reasons: [...message.reasons, `You filed this as ${CATEGORY_LABEL[category]}.`],
  };
}
