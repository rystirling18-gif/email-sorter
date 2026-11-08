export type Category =
  | "personal"
  | "school"
  | "client"
  | "new_client_lead"
  | "finance"
  | "accounts"
  | "subscriptions"
  | "receipts"
  | "social_media"
  | "newsletters"
  | "spam"
  | "review";

export type Badge =
  | "NEW CLIENT LEAD"
  | "CLIENT"
  | "SCHOOL"
  | "PERSONAL"
  | "IMPORTANT"
  | "REVIEW";

export type MailFolder = "inbox" | "archive" | "spam" | "trash";

export type Confidence = "high" | "medium" | "low";

export interface Profile {
  name: string;
  emails: string[];
  businessName: string;
  businessAliases: string[];
  schoolDomains: string[];
  knownClients: KnownClient[];
}

export interface KnownClient {
  name: string;
  email: string;
}

export interface IncomingEmail {
  fromName: string;
  fromEmail: string;
  to: string[];
  subject: string;
  body: string;
}

export interface Classification {
  category: Category;
  important: boolean;
  protected: boolean;
  action: "keep" | "archive" | "spam" | "review";
  badge: Badge | null;
  reasons: string[];
  confidence: Confidence;
}

export interface StoredEmail extends IncomingEmail {
  id: string;
  date: string;
  folder: MailFolder;
  read: boolean;
  important: boolean;
  protected: boolean;
  flaggedForReview: boolean;
  category: Category | null;
  badge: Badge | null;
  reasons: string[];
  confidence: Confidence | null;
  userOverride: boolean;
  source: "sample" | "import";
}

export interface OrganiseReport {
  at: string;
  kept: number;
  archived: number;
  spam: number;
  review: number;
  skipped: number;
  deleted: number;
  leads: string[];
  school: number;
}

export type SidebarFolder =
  | "inbox"
  | "review"
  | "important"
  | "personal"
  | "school"
  | "client"
  | "new_client_lead"
  | "finance"
  | "accounts"
  | "subscriptions"
  | "receipts"
  | "social_media"
  | "newsletters"
  | "archive"
  | "spam"
  | "trash";
