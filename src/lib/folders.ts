import type { FolderId, Message } from "../types";

export interface FolderDef {
  id: FolderId;
  label: string;
  group: "Attention" | "Keep safe" | "Filed";
}

export const FOLDERS: FolderDef[] = [
  { id: "inbox", label: "Inbox", group: "Attention" },
  { id: "review", label: "Needs review", group: "Attention" },
  { id: "important", label: "Important", group: "Attention" },
  { id: "personal", label: "Personal", group: "Keep safe" },
  { id: "school", label: "School", group: "Keep safe" },
  { id: "leads", label: "New client leads", group: "Keep safe" },
  { id: "clients", label: "Clients", group: "Keep safe" },
  { id: "finance", label: "Finance", group: "Filed" },
  { id: "accounts", label: "Accounts", group: "Filed" },
  { id: "receipts", label: "Receipts", group: "Filed" },
  { id: "subscriptions", label: "Subscriptions", group: "Filed" },
  { id: "social", label: "Social media", group: "Filed" },
  { id: "newsletters", label: "Newsletters", group: "Filed" },
  { id: "spam", label: "Spam", group: "Filed" },
  { id: "archive", label: "Archive", group: "Filed" },
];

function hasLabel(message: Message, label: string): boolean {
  return message.labels.includes(label);
}

export function matchesFolder(message: Message, folder: FolderId): boolean {
  switch (folder) {
    case "inbox":
      return message.inInbox && !message.spam;
    case "review":
      return message.review && !message.spam;
    case "important":
      return message.important && !message.spam;
    case "personal":
      return message.category === "personal" && !message.spam;
    case "school":
      return (message.category === "school" || hasLabel(message, "SCHOOL")) && !message.spam;
    case "leads":
      return (message.category === "new_client_lead" || hasLabel(message, "NEW CLIENT LEAD")) && !message.spam;
    case "clients":
      return (message.category === "client" || hasLabel(message, "CLIENT")) && !message.spam;
    case "finance":
      return (message.category === "finance" || hasLabel(message, "FINANCE")) && !message.spam;
    case "accounts":
      return (message.category === "accounts" || hasLabel(message, "ACCOUNTS")) && !message.spam;
    case "receipts":
      return message.category === "receipts" && !message.spam;
    case "subscriptions":
      return message.category === "subscriptions" && !message.spam;
    case "social":
      return message.category === "social" && !message.spam;
    case "newsletters":
      return message.category === "newsletters" && !message.spam;
    case "spam":
      return message.spam;
    case "archive":
      return message.archived && !message.spam;
    default:
      return false;
  }
}

export function filterMessages(messages: Message[], folder: FolderId, query: string): Message[] {
  const needle = query.trim().toLowerCase();
  return messages
    .filter((message) => matchesFolder(message, folder))
    .filter((message) => {
      if (!needle) return true;
      const blob = `${message.fromName} ${message.fromEmail} ${message.subject} ${message.bodyText} ${message.labels.join(" ")}`.toLowerCase();
      return blob.includes(needle);
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
