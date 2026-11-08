import type { Category, SidebarFolder } from "./types";

export interface FolderMeta {
  id: SidebarFolder;
  label: string;
  section: "Now" | "Keep close" | "Reference" | "Put away";
}

export const FOLDERS: FolderMeta[] = [
  { id: "inbox", label: "Inbox", section: "Now" },
  { id: "review", label: "Needs review", section: "Now" },
  { id: "important", label: "Important", section: "Now" },
  { id: "school", label: "School", section: "Keep close" },
  { id: "new_client_lead", label: "New client leads", section: "Keep close" },
  { id: "client", label: "Clients", section: "Keep close" },
  { id: "personal", label: "Personal", section: "Keep close" },
  { id: "finance", label: "Finance", section: "Reference" },
  { id: "accounts", label: "Accounts", section: "Reference" },
  { id: "subscriptions", label: "Subscriptions", section: "Reference" },
  { id: "receipts", label: "Receipts", section: "Reference" },
  { id: "social_media", label: "Social media", section: "Reference" },
  { id: "newsletters", label: "Newsletters", section: "Reference" },
  { id: "archive", label: "Archive", section: "Put away" },
  { id: "spam", label: "Spam", section: "Put away" },
  { id: "trash", label: "Trash", section: "Put away" },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  personal: "Personal",
  school: "School",
  client: "Client",
  new_client_lead: "New client lead",
  finance: "Finance",
  accounts: "Accounts",
  subscriptions: "Subscriptions",
  receipts: "Receipts",
  social_media: "Social media",
  newsletters: "Newsletters",
  spam: "Spam",
  review: "Needs review",
};

export const SECTIONS = ["Now", "Keep close", "Reference", "Put away"] as const;
