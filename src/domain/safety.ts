import type { StoredEmail } from "./types";

/** Why a destructive action must wait, or null when it is allowed. */
export function removalBlockReason(email: StoredEmail, explicitApproval: boolean): string | null {
  if (explicitApproval) return null;
  if (
    email.protected ||
    email.flaggedForReview ||
    email.category === null ||
    email.category === "review" ||
    email.category === "personal" ||
    email.category === "school" ||
    email.category === "client" ||
    email.category === "new_client_lead"
  ) {
    return "Personal, school, client, and uncertain mail can only be deleted if you specifically approve it.";
  }
  return null;
}
