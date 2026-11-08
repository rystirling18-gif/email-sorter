import type { Classification, IncomingEmail, Priority, SafetyLock, Settings } from "../types";
import {
  domainOf,
  emailAddress,
  firstName,
  includesDomain,
  looksLikeEducationDomain,
  lower,
  unique,
} from "./text";

const STRONG_SCHOOL =
  /\b(homework|assignment|coursework|exams?|examination|timetable|parents?' evening|inset|school trip|report card|attendance|headteacher|form tutor|mock exams?|revision session|term dates|sixth form|detention|pupil)\b/i;

const STAFF_NAME = /^(mr|mrs|ms|miss|dr|prof|headteacher|head of)\b/i;

const LEAD_ASK =
  /\b(i|we)\b[\s\S]{0,90}\b(quote|quotation|price|pricing|rates|fees|hire|book|booking|website|site|services?|package|available|availability|project)\b/i;

const DIRECT_ASK =
  /\b(can|could|would) you\b[\s\S]{0,80}\b(quote|build|design|help|make|send|tell me)\b/i;

const PRICE_ASK =
  /\b(how much (do you|would you|does it|is (a|your))|what do you charge|what are your (rates|prices|fees)|can i get a quote|request a quote)\b/i;

const SELLING_TO_USER =
  /\b(we offer|our (team|packages|seo)|boost your|increase your (sales|traffic)|special offer|discount code|limited time|% off|backlinks)\b/i;

const SCAM_PAYMENT =
  /\b(bitcoin|crypto wallet|gift cards?|western union|wire transfer|kindly (send|pay)|overpayment)\b/i;

const SPAM_HARD =
  /\b(viagra|cialis|casino|lottery winner|you have been selected|nigerian prince|make money fast|crypto airdrop|weight loss miracle|work from home \$)\b/i;

const CREDENTIAL_TRAP =
  /\b(password (will )?expire|reset your password|verify your (account|identity)|account (suspended|locked)|confirm your identity|unusual (sign-in|login))\b/i;

const CLICK_BAIT = /\b(click here|verify now|log ?in here|update your details)\b/i;

const SHORT_LINK = /\b(bit\.ly|tinyurl\.com|rb\.gy|t\.co\/|shorturl\.at)\b/i;

const ACCOUNT_SECURITY =
  /\b(password reset|reset your password|new sign-in|new login|security alert|unusual (sign-in|login|activity)|verification code|one-time code|two-factor|2fa code)\b/i;

const FINANCE =
  /\b(bank statement|account statement|sort code|hmrc|self assessment|vat return|payslip|council tax|national insurance|annual tax)\b/i;

const RECEIPT =
  /\b(your receipt|order confirmation|thanks for your order|your order has (shipped|been dispatched)|payment receipt|vat receipt|dispatch confirmation)\b/i;

const SUBSCRIPTION =
  /\b(your subscription|subscription (has )?renew|membership renew|plan renews|your (premium|plus) plan|renews on)\b/i;

const SOCIAL_NOTICE =
  /\b(liked your (photo|post)|commented on your (photo|post)|started following you|new follower|mentioned you in|friend request|tagged you in)\b/i;

const NEWSLETTER =
  /\b(newsletter|view (this )?in (your )?browser|this week in|weekly digest|edition \d+)\b/i;

const IMPORTANT_LIFE =
  /\b(\bnhs\b|gp surgery|hospital appointment|solicitor|passport application|driving licence|jury service|court date)\b/i;

const BULK_HINT =
  /\b(unsubscribe|view in browser|email preferences|manage your preferences)\b/i;

function haystack(email: IncomingEmail): string {
  return `${email.subject}\n${email.bodyText}`;
}

function isBulk(email: IncomingEmail, text: string): boolean {
  const from = emailAddress(email.fromEmail);
  return (
    BULK_HINT.test(text) ||
    /^(no-?reply|newsletter|news|notifications?)@/.test(from) ||
    /\bprecedence:\s*bulk\b/i.test(text)
  );
}

function trustedSchool(domain: string, settings: Settings): boolean {
  return looksLikeEducationDomain(domain) || includesDomain(domain, settings.schoolDomains);
}

function knownClient(email: string, domain: string, settings: Settings): boolean {
  const address = emailAddress(email);
  const knownAddress = settings.knownClientEmails.some(
    (entry) => emailAddress(entry) === address,
  );
  return knownAddress || includesDomain(domain, settings.knownClientDomains);
}

function fromSelf(email: IncomingEmail, settings: Settings): boolean {
  const address = emailAddress(email.fromEmail);
  return settings.ownerEmails.some((entry) => emailAddress(entry) === address);
}

function businessMention(text: string, settings: Settings): boolean {
  const name = settings.businessName.trim();
  if (name.length < 3) return false;
  return lower(text).includes(lower(name));
}

function leadIntent(text: string, settings: Settings): boolean {
  const asks = LEAD_ASK.test(text) || DIRECT_ASK.test(text) || PRICE_ASK.test(text);
  const namedAsk = businessMention(text, settings) && /\b(quote|price|hire|book|enquir|interest|service)\b/i.test(text);
  return asks || namedAsk;
}

function claimsSchool(email: IncomingEmail, settings: Settings): boolean {
  const name = lower(email.fromName);
  if (/\b(school|headteacher|parentmail|it desk|it support)\b/i.test(email.fromName)) return true;
  return settings.schoolDomains.some((domain) => {
    const label = domain.split(".")[0] ?? "";
    return label.length > 3 && name.includes(label.toLowerCase());
  });
}

function staffOrStrongSchool(email: IncomingEmail, text: string): boolean {
  return STRONG_SCHOOL.test(text) || (STAFF_NAME.test(email.fromName) && /\b(school|class|lesson|homework|exam|pupil|student|year \d+)\b/i.test(text));
}

function result(input: {
  category: Classification["category"];
  labels: string[];
  reasons: string[];
  priority: Priority;
  important: boolean;
  safetyLock: SafetyLock;
  action: Classification["action"];
}): Classification {
  return {
    ...input,
    labels: unique(input.labels),
    reasons: input.reasons.filter(Boolean),
  };
}

export function classify(email: IncomingEmail, settings: Settings): Classification {
  const text = haystack(email);
  const domain = domainOf(email.fromEmail);
  const bulk = isBulk(email, text);
  const schoolDomain = trustedSchool(domain, settings);
  const client = knownClient(email.fromEmail, domain, settings);
  const self = fromSelf(email, settings);
  const strongSchool = STRONG_SCHOOL.test(text);
  const schoolish = strongSchool || claimsSchool(email, settings) || schoolDomain;
  const lead = leadIntent(text, settings);
  const selling = SELLING_TO_USER.test(text);
  const scamPay = SCAM_PAYMENT.test(text);
  const credentialTrap = CREDENTIAL_TRAP.test(text) && (SHORT_LINK.test(text) || CLICK_BAIT.test(text) || (claimsSchool(email, settings) && !schoolDomain));
  const suspiciousSchool = schoolish && !schoolDomain && (credentialTrap || (SHORT_LINK.test(text) && CREDENTIAL_TRAP.test(text)));
  const suspiciousMoney = scamPay && (lead || client || businessMention(text, settings) || /\b(deposit|invoice|payment)\b/i.test(text));
  const hardSpam = SPAM_HARD.test(text);
  const owner = firstName(settings.ownerName);

  if (self) {
    return result({
      category: "personal",
      labels: ["PERSONAL", "IMPORTANT"],
      reasons: [
        `This was sent from ${email.fromEmail}, which is one of your addresses. It stays protected.`,
      ],
      priority: "high",
      important: true,
      safetyLock: "self",
      action: "keep_inbox",
    });
  }

  if (suspiciousSchool) {
    return result({
      category: "review",
      labels: ["NEEDS REVIEW", "SCHOOL"],
      reasons: [
        "This talks about school, but the sender is not on a school domain you trust and it asks you to verify or click through.",
        "It is flagged for review and kept. It has not been deleted.",
      ],
      priority: "high",
      important: true,
      safetyLock: "uncertain",
      action: "review",
    });
  }

  if (schoolDomain || (staffOrStrongSchool(email, text) && !bulk && !credentialTrap)) {
    const why = schoolDomain
      ? `The sender domain ${domain} is treated as school or education mail.`
      : "The message is about school work, staff, or deadlines.";
    return result({
      category: "school",
      labels: ["SCHOOL", "IMPORTANT"],
      reasons: [`${why} School mail stays in the inbox and is not deleted.`],
      priority: "high",
      important: true,
      safetyLock: "school",
      action: "keep_inbox",
    });
  }

  if (schoolish && bulk && !schoolDomain) {
    return result({
      category: "review",
      labels: ["NEEDS REVIEW", "SCHOOL"],
      reasons: [
        "This looks like a school announcement, but it was sent as a bulk email from outside your school domains.",
        "It is kept in review in case it is a real school message.",
      ],
      priority: "high",
      important: true,
      safetyLock: "uncertain",
      action: "review",
    });
  }

  if (client && suspiciousMoney) {
    return result({
      category: "review",
      labels: ["NEEDS REVIEW", "CLIENT"],
      reasons: [
        "This is from a known client, but it also asks for an unusual payment.",
        "It is flagged for review and cannot be deleted.",
      ],
      priority: "high",
      important: true,
      safetyLock: "client",
      action: "review",
    });
  }

  if (client) {
    return result({
      category: "client",
      labels: ["CLIENT", "IMPORTANT"],
      reasons: [
        `${email.fromName || email.fromEmail} is saved as an existing client. Client mail is kept and never deleted.`,
      ],
      priority: "high",
      important: true,
      safetyLock: "client",
      action: "keep_inbox",
    });
  }

  if (lead && suspiciousMoney) {
    return result({
      category: "review",
      labels: ["NEEDS REVIEW", "NEW CLIENT LEAD"],
      reasons: [
        "Someone is asking about your services, but the payment request looks unsafe.",
        "Marked for review as a possible new client lead. It is not deleted.",
      ],
      priority: "high",
      important: true,
      safetyLock: "lead",
      action: "review",
    });
  }

  if (lead && !bulk && !selling) {
    return result({
      category: "new_client_lead",
      labels: ["NEW CLIENT LEAD", "IMPORTANT"],
      reasons: [
        `This person is asking about buying or booking ${settings.businessName || "your services"}.`,
        "Marked as a new client lead and kept in the inbox.",
      ],
      priority: "high",
      important: true,
      safetyLock: "lead",
      action: "keep_inbox",
    });
  }

  if ((ACCOUNT_SECURITY.test(text) || credentialTrap) && (SHORT_LINK.test(text) || (credentialTrap && !schoolDomain))) {
    return result({
      category: "review",
      labels: ["NEEDS REVIEW", "ACCOUNTS"],
      reasons: [
        "This looks like an account or password warning, and the link or sender is not trustworthy enough to file automatically.",
        "Flagged for review and kept.",
      ],
      priority: "high",
      important: true,
      safetyLock: "uncertain",
      action: "review",
    });
  }

  if (ACCOUNT_SECURITY.test(text)) {
    return result({
      category: "accounts",
      labels: ["ACCOUNTS", "IMPORTANT"],
      reasons: ["This is an account or sign-in notice. It stays in the inbox."],
      priority: "normal",
      important: true,
      safetyLock: null,
      action: "keep_inbox",
    });
  }

  if (hardSpam) {
    return result({
      category: "spam",
      labels: ["SPAM"],
      reasons: ["This matches obvious spam. It is moved to spam and not deleted."],
      priority: "low",
      important: false,
      safetyLock: null,
      action: "spam",
    });
  }

  if (bulk && selling) {
    return result({
      category: "spam",
      labels: ["SPAM"],
      reasons: ["This is unwanted advertising sent to you. It is moved to spam and kept there until you delete it."],
      priority: "low",
      important: false,
      safetyLock: null,
      action: "spam",
    });
  }

  if (FINANCE.test(text) && !RECEIPT.test(text)) {
    return result({
      category: "finance",
      labels: ["FINANCE", "IMPORTANT"],
      reasons: ["This looks like banking, tax, or another finance record. It stays in the inbox."],
      priority: "normal",
      important: true,
      safetyLock: null,
      action: "keep_inbox",
    });
  }

  if (RECEIPT.test(text)) {
    return result({
      category: "receipts",
      labels: ["RECEIPTS"],
      reasons: ["This is a receipt or order update. It is archived out of the inbox and kept under Receipts."],
      priority: "normal",
      important: false,
      safetyLock: null,
      action: "archive",
    });
  }

  if (SUBSCRIPTION.test(text)) {
    return result({
      category: "subscriptions",
      labels: ["SUBSCRIPTIONS"],
      reasons: ["This is a subscription notice. It is archived and kept under Subscriptions."],
      priority: "low",
      important: false,
      safetyLock: null,
      action: "archive",
    });
  }

  if (SOCIAL_NOTICE.test(text)) {
    return result({
      category: "social",
      labels: ["SOCIAL MEDIA"],
      reasons: ["This is a social media notification. It is archived and kept under Social media."],
      priority: "low",
      important: false,
      safetyLock: null,
      action: "archive",
    });
  }

  if (IMPORTANT_LIFE.test(text)) {
    return result({
      category: "important",
      labels: ["IMPORTANT"],
      reasons: ["This looks like health, legal, or official personal admin. It stays in the inbox."],
      priority: "high",
      important: true,
      safetyLock: "uncertain",
      action: "keep_inbox",
    });
  }

  if (NEWSLETTER.test(text) || bulk) {
    return result({
      category: "newsletters",
      labels: ["NEWSLETTERS"],
      reasons: ["This is a newsletter. It is archived out of the inbox and kept under Newsletters."],
      priority: "low",
      important: false,
      safetyLock: null,
      action: "archive",
    });
  }

  const named = owner.length > 1 && new RegExp(`\\b${owner}\\b`, "i").test(text);
  const humanSender = Boolean(email.fromName.trim()) && !/^(no-?reply|notifications?)$/i.test(email.fromName);
  if (named && humanSender && !bulk && text.length < 5000) {
    return result({
      category: "personal",
      labels: ["PERSONAL", "IMPORTANT"],
      reasons: [
        `This is a direct message that mentions ${owner}. It is filed as personal and kept.`,
      ],
      priority: "high",
      important: true,
      safetyLock: "personal",
      action: "keep_inbox",
    });
  }

  return result({
    category: "review",
    labels: ["NEEDS REVIEW"],
    reasons: [
      "This does not clearly match a folder. It is kept in the inbox and flagged for review.",
    ],
    priority: "high",
    important: true,
    safetyLock: "uncertain",
    action: "review",
  });
}
