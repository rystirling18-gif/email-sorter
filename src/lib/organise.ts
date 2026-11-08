import { classify } from "./classify";
import type { Classification, IncomingEmail, Message, Settings } from "../types";
import { hashId } from "./text";

function place(base: Message, filing: Classification): Message {
  const spam = filing.action === "spam";
  const archived = filing.action === "archive";
  const review = filing.action === "review";
  return {
    ...base,
    category: filing.category,
    labels: filing.labels,
    reasons: filing.reasons,
    priority: filing.priority,
    important: filing.important,
    safetyLock: filing.safetyLock,
    review,
    inInbox: !spam && !archived,
    archived,
    spam,
  };
}

export function messageFromIncoming(
  email: IncomingEmail,
  settings: Settings,
  extras: { sample?: boolean; id?: string } = {},
): Message {
  const filing = classify(email, settings);
  const base: Message = {
    ...email,
    id: extras.id ?? hashId([email.messageId, email.fromEmail, email.subject, email.date]),
    category: filing.category,
    labels: filing.labels,
    reasons: filing.reasons,
    priority: filing.priority,
    important: filing.important,
    safetyLock: filing.safetyLock,
    review: false,
    inInbox: true,
    archived: false,
    spam: false,
    read: false,
    manualOverride: false,
    sample: extras.sample ?? false,
  };
  return place(base, filing);
}

export function organiseMessage(message: Message, settings: Settings): Message {
  if (message.manualOverride) {
    if (message.safetyLock && message.spam) {
      return {
        ...message,
        spam: false,
        inInbox: true,
        archived: false,
        review: true,
      };
    }
    return message;
  }
  return place(message, classify(message, settings));
}

export function organiseMailbox(messages: Message[], settings: Settings): Message[] {
  return messages.map((message) => organiseMessage(message, settings));
}

export function addEmails(
  current: Message[],
  incoming: IncomingEmail[],
  settings: Settings,
  options: { dropSample?: boolean } = {},
): { messages: Message[]; added: number } {
  const base = options.dropSample ? current.filter((message) => !message.sample) : current;
  const known = new Set(base.map((message) => message.messageId));
  const fresh = incoming.filter((email) => email.fromEmail && email.messageId && !known.has(email.messageId));
  const added = fresh.map((email) => messageFromIncoming(email, settings));
  return { messages: [...added, ...base], added: added.length };
}

export interface OrganiseSummary {
  kept: number;
  archived: number;
  spam: number;
  review: number;
  protected: number;
}

export function summarise(messages: Message[]): OrganiseSummary {
  return messages.reduce<OrganiseSummary>(
    (summary, message) => {
      if (message.spam) summary.spam += 1;
      else if (message.archived) summary.archived += 1;
      else summary.kept += 1;
      if (message.review) summary.review += 1;
      if (message.safetyLock) summary.protected += 1;
      return summary;
    },
    { kept: 0, archived: 0, spam: 0, review: 0, protected: 0 },
  );
}
