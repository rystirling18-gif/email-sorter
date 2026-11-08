import type { Classification, IncomingEmail, Profile } from "./types";
import { normaliseProfile } from "./profile";
import { anyPhrase, countPhrases, domainOf, hasPhrase, isPublicMailbox, normaliseText } from "./text";

const TRUSTED_SCHOOL_ROLES = [
  "teacher",
  "head of year",
  "head of department",
  "headteacher",
  "head teacher",
  "deputy head",
  "exams officer",
  "school office",
  "head of sixth form",
];

const STRONG_SCHOOL = [
  "homework",
  "coursework",
  "assignment",
  "mock exam",
  "exam timetable",
  "examination",
  "parents' evening",
  "parents evening",
  "school trip",
  "inset day",
  "teacher training day",
  "headteacher",
  "head teacher",
  "exams officer",
  "report card",
  "ofsted",
  "detention",
  "tutor group",
  "school announcement",
  "school closure",
  "school bulletin",
  "school newsletter",
  "gcse",
  "a-level",
  "exams",
  "exam",
];

const STRONG_LEAD = [
  "how much",
  "what do you charge",
  "your rates",
  "price list",
  "interested in your",
  "interested in working",
  "do you offer",
  "can you build",
  "can you design",
  "can you make a",
  "can you make us",
  "i'd like to hire",
  "i would like to hire",
  "looking to hire",
  "looking for a developer",
  "looking for a designer",
  "looking for someone to",
  "book a call",
  "book a consultation",
  "request a callback",
  "sales enquiry",
  "sales inquiry",
  "new enquiry",
  "need a website",
  "need a new website",
  "your services",
  "about your services",
  "could you build",
  "could you design",
  "would you design",
  "looking for a quote",
  "request a quote",
  "get a quote",
];

const WEAK_LEAD = [
  "quote",
  "quotation",
  "pricing",
  "following up",
  "still interested",
  "our budget",
  "start a project",
  "redesign our",
];

const COMMERCIAL = [
  "website",
  "web design",
  "brochure",
  "logo",
  "landing page",
  "redesign",
  "seo",
];

const OUTBOUND_PITCH = [
  "boost your",
  "grow your business",
  "we help businesses",
  "limited time",
  "act now",
  "special offer",
  "exclusive deal",
  "guaranteed page",
  "buy leads",
  "increase your traffic",
  "seo package",
  "rank on google",
  "work from home",
  "we provide",
  "we offer",
];

const BULK = [
  "unsubscribe",
  "view in browser",
  "you are receiving this",
  "email preferences",
  "manage your preferences",
];

const EXTREME_SCAM = [
  "you have won",
  "lottery",
  "inheritance",
  "seed phrase",
  "crypto wallet",
  "bitcoin",
  "wire transfer",
  "gift card",
  "casino",
  "viagra",
  "claim your prize",
  "funds to release",
];

const PHISHING = [
  "verify your account",
  "verify your password",
  "account will be closed",
  "account has been suspended",
  "account suspended",
  "confirm your identity",
  "password expires",
  "restore your account",
  "update your payment details",
  "unusual activity on your account",
];

const PAYMENT_REDIRECT = [
  "payment details have changed",
  "bank details have changed",
  "new bank account",
  "pay immediately",
  "urgent payment",
];

const RECEIPT = [
  "receipt",
  "order confirmation",
  "your order",
  "has been dispatched",
  "out for delivery",
  "payment received",
  "thanks for your order",
  "order number",
];

const FINANCE = [
  "bank statement",
  "direct debit",
  "tax return",
  "vat return",
  "payslip",
  "hmrc",
  "self assessment",
  "account balance",
];

const FINANCE_DOMAINS = [
  "hmrc.gov.uk",
  "monzo.com",
  "starlingbank.com",
  "barclays.co.uk",
  "lloydsbank.com",
  "hsbc.co.uk",
  "natwest.com",
  "santander.co.uk",
  "revolut.com",
  "paypal.com",
  "paypal.co.uk",
];

const SUBSCRIPTION = [
  "your subscription",
  "subscription",
  "membership",
  "your plan",
  "renews on",
  "will renew",
  "free trial",
  "premium plan",
];

const SOCIAL_DOMAINS = [
  "facebookmail.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "pinterest.com",
  "reddit.com",
];

const SOCIAL_PHRASES = [
  "commented on your",
  "new follower",
  "liked your",
  "mentioned you in",
  "sent you a message on",
];

const ACCOUNT_DOMAINS = [
  "google.com",
  "accounts.google.com",
  "apple.com",
  "id.apple.com",
  "microsoft.com",
  "github.com",
  "amazon.co.uk",
  "amazon.com",
];

const ACCOUNT_PHRASES = [
  "new sign-in",
  "new sign in",
  "password was reset",
  "password reset",
  "security alert",
  "2-step verification",
  "verification code",
  "new device",
];

const NEWSLETTER = ["newsletter", "weekly digest", "daily digest", "this week in", "roundup"];

const PERSONAL_TOPICS = [
  "gp appointment",
  "nhs",
  "dentist",
  "hospital appointment",
  "prescription",
  "your appointment",
];

function result(
  partial: Omit<Classification, "reasons"> & { reasons: string[] },
): Classification {
  return partial;
}

function review(reasons: string[], confidence: Classification["confidence"] = "medium"): Classification {
  return result({
    category: "review",
    important: true,
    protected: true,
    action: "review",
    badge: "REVIEW",
    reasons,
    confidence,
  });
}

function kept(
  category: Classification["category"],
  badge: Classification["badge"],
  reasons: string[],
  confidence: Classification["confidence"],
  flagged = false,
): Classification {
  return result({
    category,
    important: true,
    protected: true,
    action: flagged ? "review" : "keep",
    badge,
    reasons,
    confidence,
  });
}

export function classify(email: IncomingEmail, rawProfile: Profile): Classification {
  const profile = normaliseProfile(rawProfile);
  const subject = normaliseText(email.subject);
  const body = normaliseText(email.body);
  const fromName = normaliseText(email.fromName);
  const text = normaliseText(`${email.subject}\n${email.fromName}\n${email.body}`);
  const fromEmail = email.fromEmail.trim().toLowerCase();
  const domain = domainOf(fromEmail);

  const self = profile.emails.includes(fromEmail);
  const knownClient = findClient(fromEmail, domain, profile);
  const trustedSchool = isTrustedSchool(fromName, domain, text, profile);
  const schoolBusiness = mentionsSchoolBusiness(text);
  const lead = isSalesLead(text, profile);
  const outbound = anyPhrase(text, OUTBOUND_PITCH);
  const bulk = anyPhrase(text, BULK);
  const extreme = anyPhrase(text, EXTREME_SCAM);
  const phishing = anyPhrase(text, PHISHING);
  const paymentRedirect = anyPhrase(text, PAYMENT_REDIRECT);
  const suspicious = extreme || phishing || paymentRedirect;
  const promoCount = countPhrases(text, [...OUTBOUND_PITCH, ...EXTREME_SCAM, "discount", "% off", "buy now"]);

  if (self) {
    return kept(
      "personal",
      "PERSONAL",
      ["Sent from one of your own addresses, so it stays in the inbox and is protected from deletion."],
      "high",
    );
  }

  if (knownClient) {
    const reasons = [
      `${knownClient.name || knownClient.email} is a saved client, so this is marked CLIENT and kept in the inbox.`,
    ];
    if (suspicious) {
      reasons.push("The wording also looks suspicious, so it is flagged for you to check before you act on it.");
      return kept("client", "CLIENT", reasons, "medium", true);
    }
    return kept("client", "CLIENT", reasons, "high");
  }

  if (trustedSchool) {
    const reasons = [
      schoolSenderReason(fromName, domain, profile),
      "School mail stays in the inbox, marked important, and is never deleted unless you specifically approve it.",
    ];
    if (suspicious && !isSchoolDomain(domain, profile)) {
      return review([
        "This names a school role, but the address is not one of your saved school domains and the wording looks suspicious.",
        "It is flagged for review and has not been deleted.",
      ]);
    }
    if (suspicious) {
      reasons.push("It also asks for something sensitive, so it is flagged for review as well as filed under School.");
      return kept("school", "SCHOOL", reasons, "medium", true);
    }
    return kept("school", "SCHOOL", reasons, "high");
  }

  if (lead && !outbound && !bulk) {
    if (suspicious) {
      return review([
        `This reads like someone asking about ${profile.businessName}, so it might be a new client lead.`,
        "It also looks suspicious, so it is flagged for review instead of being binned.",
      ]);
    }
    return kept(
      "new_client_lead",
      "NEW CLIENT LEAD",
      [
        `Someone is asking about buying or booking ${profile.businessName}. Marked NEW CLIENT LEAD and kept in the inbox.`,
      ],
      "high",
    );
  }

  if ((schoolBusiness || hasPhrase(text, "school")) && suspicious) {
    return review([
      "This mentions school, but the sender is not a saved school address and the message looks suspicious.",
      "It is flagged for review and has not been deleted.",
    ]);
  }

  if (schoolBusiness && !(lead && (hasPhrase(text, "website") || hasPhrase(text, "design")))) {
    return kept(
      "school",
      "SCHOOL",
      ["This is about school, homework, exams, or a school event, so it stays in the inbox and is protected."],
      "high",
    );
  }

  if (lead && bulk && anyPhrase(text, NEWSLETTER) && !suspicious) {
    return archive(
      "newsletters",
      ["This is a newsletter that mentions pricing or services. It is archived, not treated as a client lead."],
      "medium",
    );
  }

  if (lead && (outbound || bulk)) {
    return review([
      "This mentions services or pricing, but it also looks like a bulk or sales pitch sent to you.",
      "Kept for review in case it is a real enquiry. Nothing was deleted.",
    ]);
  }

  if (paymentRedirect) {
    return review([
      "This asks you to use new or urgent payment details. That is a common invoice scam.",
      "Flagged for review and left in the inbox.",
    ]);
  }

  if (phishing && (isTrustedAccount(domain) || isFinanceDomain(domain))) {
    return review([
      "This looks like a security or payment warning from a finance or account address.",
      "It might be real, so it is flagged for review and left in the inbox.",
    ]);
  }

  if (extreme || phishing) {
    return spam([
      "This looks like phishing or a scam.",
      "Moved to spam. It was not deleted, so you can still check it.",
    ]);
  }

  if (isReceipt(text) && !hasPhrase(text, "your services")) {
    return archive(
      "receipts",
      ["This is a receipt or order confirmation, so it is labelled Receipts and archived out of the inbox."],
      "high",
    );
  }

  if (isFinance(text, domain)) {
    return archive(
      "finance",
      ["This is finance or tax mail, so it is labelled Finance and archived. It was not deleted."],
      "high",
    );
  }

  if (isSocial(text, domain)) {
    return archive(
      "social_media",
      ["This is a social media notification, so it is labelled and archived out of the inbox."],
      "high",
    );
  }

  if (isSubscription(text, domain) && !phishing) {
    return archive(
      "subscriptions",
      ["This is about a subscription or membership, so it is labelled and archived."],
      "high",
    );
  }

  if (isTrustedAccount(domain) && (anyPhrase(text, ACCOUNT_PHRASES) || phishing)) {
    return archive(
      "accounts",
      ["This is an account or sign-in notice from a known provider, so it is labelled Accounts and archived."],
      "high",
    );
  }

  if (anyPhrase(text, NEWSLETTER) || (bulk && !extreme && promoCount < 2)) {
    return archive(
      "newsletters",
      ["This is a newsletter, so it is labelled and archived. It was not treated as spam."],
      anyPhrase(text, NEWSLETTER) ? "high" : "medium",
    );
  }

  if (bulk && (outbound || promoCount >= 1)) {
    return spam([
      "This is unwanted advertising.",
      "Moved to spam and not deleted.",
    ]);
  }

  if (anyPhrase(text, PERSONAL_TOPICS)) {
    return kept(
      "personal",
      "PERSONAL",
      ["This relates directly to you, so it stays in the inbox and is protected."],
      "high",
    );
  }

  if (isPersonalLetter(subject, body, fromName, profile) && !outbound && !bulk && !suspicious) {
    return kept(
      "personal",
      "PERSONAL",
      ["This is a direct message to you, so it is filed as Personal and kept in the inbox."],
      "medium",
    );
  }

  if (outbound) {
    return spam([
      "This is an unsolicited sales pitch.",
      "Moved to spam and not deleted.",
    ]);
  }

  return review([
    "This does not clearly match school, a client, personal mail, or junk.",
    "Left in the inbox and flagged for review. Nothing uncertain is deleted.",
  ]);
}

function spam(reasons: string[]): Classification {
  return result({
    category: "spam",
    important: false,
    protected: false,
    action: "spam",
    badge: null,
    reasons,
    confidence: "high",
  });
}

function archive(
  category: Classification["category"],
  reasons: string[],
  confidence: Classification["confidence"],
): Classification {
  return result({
    category,
    important: false,
    protected: false,
    action: "archive",
    badge: null,
    reasons,
    confidence,
  });
}

function findClient(fromEmail: string, domain: string, profile: Profile) {
  const exact = profile.knownClients.find((client) => client.email === fromEmail);
  if (exact) return exact;
  if (!domain || isPublicMailbox(domain)) return undefined;
  return profile.knownClients.find((client) => domainOf(client.email) === domain);
}

function isSchoolDomain(domain: string, profile: Profile): boolean {
  if (domain.endsWith(".sch.uk")) return true;
  return profile.schoolDomains.some((item) => item && (domain === item || domain.endsWith(`.${item}`)));
}

function isTrustedSchool(fromName: string, domain: string, text: string, profile: Profile): boolean {
  if (isSchoolDomain(domain, profile)) return true;
  if (anyPhrase(text, BULK)) return false;
  return anyPhrase(fromName, TRUSTED_SCHOOL_ROLES);
}

function schoolSenderReason(fromName: string, domain: string, profile: Profile): string {
  if (isSchoolDomain(domain, profile)) {
    return `The sender is a school address (${domain}).`;
  }
  return `${fromName || "The sender"} looks like school staff.`;
}

function mentionsSchoolBusiness(text: string): boolean {
  return anyPhrase(text, STRONG_SCHOOL);
}

function mentionsBusiness(text: string, profile: Profile): boolean {
  return profile.businessAliases.some((alias) => alias.length > 2 && text.includes(alias));
}

function isSalesLead(text: string, profile: Profile): boolean {
  if (anyPhrase(text, STRONG_LEAD)) return true;
  const commercial = anyPhrase(text, COMMERCIAL) || mentionsBusiness(text, profile);
  if (anyPhrase(text, WEAK_LEAD) && commercial) return true;
  return (
    mentionsBusiness(text, profile) &&
    (text.includes("?") || anyPhrase(text, ["please", "could you", "can you", "would like", "interested"]))
  );
}

function isReceipt(text: string): boolean {
  if (anyPhrase(text, RECEIPT)) return true;
  return hasPhrase(text, "invoice") && anyPhrase(text, ["paid", "payment received"]);
}

function isFinanceDomain(domain: string): boolean {
  return FINANCE_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`));
}

function isFinance(text: string, domain: string): boolean {
  if (isFinanceDomain(domain)) return true;
  if (anyPhrase(text, FINANCE)) return true;
  return hasPhrase(text, "invoice") && anyPhrase(text, ["amount due", "is due", "please pay", "payment due"]);
}

function isSocial(text: string, domain: string): boolean {
  if (SOCIAL_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    return true;
  }
  return anyPhrase(text, SOCIAL_PHRASES);
}

function isSubscription(text: string, domain: string): boolean {
  const streaming = ["netflix.com", "spotify.com", "disneyplus.com", "primevideo.com"];
  if (streaming.some((item) => domain === item || domain.endsWith(`.${item}`))) return true;
  if (anyPhrase(text, SUBSCRIPTION)) return true;
  return false;
}

function isTrustedAccount(domain: string): boolean {
  return ACCOUNT_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`));
}

function isPersonalLetter(subject: string, body: string, fromName: string, profile: Profile): boolean {
  const name = normaliseText(profile.name);
  if (!name) return false;
  const first = name.split(" ")[0];
  const greeting = new RegExp(`^(hi|hello|hey|dear)\\s+${first}\\b`, "i");
  const addressed = greeting.test(body) || greeting.test(subject);
  if (!addressed) return false;
  const words = body.split(" ").filter(Boolean).length;
  return words >= 4 && words <= 180 && !anyPhrase(fromName, ["no-reply", "noreply", "newsletter"]);
}
