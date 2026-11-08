import type { Message, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

const KEY = "sorter.mailbox.v1";

export interface PersistedMailbox {
  settings: Settings;
  messages: Message[];
  usingSample: boolean;
}

function asSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const record = value as Partial<Settings>;
  return {
    ownerName: typeof record.ownerName === "string" ? record.ownerName : DEFAULT_SETTINGS.ownerName,
    ownerEmails: Array.isArray(record.ownerEmails) ? record.ownerEmails.filter((item) => typeof item === "string") : DEFAULT_SETTINGS.ownerEmails,
    businessName: typeof record.businessName === "string" ? record.businessName : DEFAULT_SETTINGS.businessName,
    schoolDomains: Array.isArray(record.schoolDomains) ? record.schoolDomains.filter((item) => typeof item === "string") : DEFAULT_SETTINGS.schoolDomains,
    knownClientEmails: Array.isArray(record.knownClientEmails) ? record.knownClientEmails.filter((item) => typeof item === "string") : DEFAULT_SETTINGS.knownClientEmails,
    knownClientDomains: Array.isArray(record.knownClientDomains) ? record.knownClientDomains.filter((item) => typeof item === "string") : DEFAULT_SETTINGS.knownClientDomains,
  };
}

export function loadMailbox(): PersistedMailbox | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedMailbox>;
    if (!Array.isArray(parsed.messages)) return null;
    return {
      settings: asSettings(parsed.settings),
      messages: parsed.messages as Message[],
      usingSample: Boolean(parsed.usingSample),
    };
  } catch {
    return null;
  }
}

export function saveMailbox(state: PersistedMailbox) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
