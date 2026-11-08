export type Category =
  | "personal"
  | "school"
  | "client"
  | "new_client_lead"
  | "important"
  | "finance"
  | "accounts"
  | "subscriptions"
  | "receipts"
  | "social"
  | "newsletters"
  | "spam"
  | "review";

export type Priority = "high" | "normal" | "low";

export type SafetyLock =
  | "self"
  | "personal"
  | "school"
  | "client"
  | "lead"
  | "uncertain"
  | null;

export type FilingAction = "keep_inbox" | "archive" | "spam" | "review";

export interface Settings {
  ownerName: string;
  ownerEmails: string[];
  businessName: string;
  schoolDomains: string[];
  knownClientEmails: string[];
  knownClientDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  ownerName: "Ryan",
  ownerEmails: ["ryan@rsdigital.example"],
  businessName: "RS Digital Services",
  schoolDomains: ["oakfield.example"],
  knownClientEmails: ["hannah@greenfieldstudio.example"],
  knownClientDomains: ["greenfieldstudio.example"],
};

export interface IncomingEmail {
  messageId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  date: string;
}

export interface Classification {
  category: Category;
  labels: string[];
  reasons: string[];
  priority: Priority;
  important: boolean;
  safetyLock: SafetyLock;
  action: FilingAction;
}

export interface Message extends IncomingEmail {
  id: string;
  category: Category;
  labels: string[];
  reasons: string[];
  priority: Priority;
  important: boolean;
  safetyLock: SafetyLock;
  review: boolean;
  inInbox: boolean;
  archived: boolean;
  spam: boolean;
  read: boolean;
  manualOverride: boolean;
  sample: boolean;
}

export type FolderId =
  | "inbox"
  | "review"
  | "important"
  | "personal"
  | "school"
  | "leads"
  | "clients"
  | "finance"
  | "accounts"
  | "receipts"
  | "subscriptions"
  | "social"
  | "newsletters"
  | "spam"
  | "archive";
