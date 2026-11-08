import type { Message } from "../types";

export interface Gate {
  allowed: boolean;
  reason: string;
}

export function spamDecision(
  message: Message,
  options: { confirmedUnimportant?: boolean } = {},
): Gate {
  switch (message.safetyLock) {
    case "self":
    case "personal":
      return { allowed: false, reason: "Personal mail stays out of spam." };
    case "school":
      return {
        allowed: false,
        reason: "School mail stays out of spam. It can only be removed if you specifically approve deletion.",
      };
    case "client":
    case "lead":
      return { allowed: false, reason: "Client and new client lead mail is never moved to spam." };
    case "uncertain":
      if (!options.confirmedUnimportant) {
        return {
          allowed: false,
          reason: "This is flagged for review. Confirm you checked it and it is not important before moving it to spam.",
        };
      }
      return { allowed: true, reason: "You confirmed this is not important." };
    default:
      if (message.important) {
        return {
          allowed: false,
          reason: "Important mail stays out of spam. Archive it if you want it out of the inbox.",
        };
      }
      return { allowed: true, reason: "This can go to spam." };
  }
}

export function deletionDecision(
  message: Message,
  options: { schoolApproved?: boolean; typed?: string; confirmed?: boolean } = {},
): Gate {
  if (message.safetyLock === "self" || message.safetyLock === "personal") {
    return { allowed: false, reason: "Personal mail is never deleted." };
  }
  if (message.safetyLock === "client" || message.safetyLock === "lead") {
    return { allowed: false, reason: "Client and potential client mail is never deleted." };
  }
  if (message.safetyLock === "uncertain") {
    return { allowed: false, reason: "This needs a decision first. It is not deleted while it is uncertain." };
  }
  if (message.safetyLock === "school") {
    if (options.schoolApproved && options.typed === "DELETE") {
      return { allowed: true, reason: "You specifically approved deleting this school email." };
    }
    return {
      allowed: false,
      reason: "School mail is kept unless you specifically approve deletion.",
    };
  }
  if (message.spam && options.confirmed) {
    return { allowed: true, reason: "Deleted from spam." };
  }
  if (message.spam) {
    return { allowed: false, reason: "Confirm deletion of this spam message." };
  }
  return {
    allowed: false,
    reason: "Only spam is deleted, and only after you confirm it. Everything else is archived or kept.",
  };
}
