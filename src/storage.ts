import { defaultProfile } from "./domain/profile";
import { createSampleMailbox } from "./domain/sampleMailbox";
import type { OrganiseReport, Profile, StoredEmail } from "./domain/types";

const KEY = "postroom.v1";

export interface AppState {
  emails: StoredEmail[];
  profile: Profile;
  report: OrganiseReport | null;
}

export function freshState(): AppState {
  return {
    emails: createSampleMailbox(),
    profile: defaultProfile,
    report: null,
  };
}

export function loadState(): AppState {
  if (typeof localStorage === "undefined") return freshState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!Array.isArray(parsed.emails) || !parsed.profile) return freshState();
    return {
      emails: parsed.emails,
      profile: parsed.profile,
      report: parsed.report ?? null,
    };
  } catch {
    return freshState();
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}
