import { describe, expect, it } from "vitest";
import { classify } from "./classifier";
import { organiseMailbox } from "./organise";
import { parseEml, parseMailJson } from "./parseMail";
import { defaultProfile } from "./profile";
import { removalBlockReason } from "./safety";
import { createSampleMailbox } from "./sampleMailbox";
import type { IncomingEmail, Profile, StoredEmail } from "./types";

const profile = defaultProfile;

function email(partial: Partial<IncomingEmail> & Pick<IncomingEmail, "fromEmail" | "subject" | "body">): IncomingEmail {
  return {
    fromName: partial.fromName ?? "",
    fromEmail: partial.fromEmail,
    to: partial.to ?? ["ryan@rsdigital.example"],
    subject: partial.subject,
    body: partial.body,
  };
}

describe("classify", () => {
  it("protects mail sent from Ryan", () => {
    const result = classify(
      email({
        fromName: "Ryan",
        fromEmail: "ryan.personal@example.com",
        subject: "Notes",
        body: "Keep the logo files.",
      }),
      profile,
    );
    expect(result.category).toBe("personal");
    expect(result.badge).toBe("PERSONAL");
    expect(result.protected).toBe(true);
    expect(result.action).toBe("keep");
    expect(result.important).toBe(true);
  });

  it("keeps school mail from a school address, including bulletins", () => {
    const homework = classify(
      email({
        fromName: "Mrs Patel",
        fromEmail: "r.patel@riverside.sch.uk",
        subject: "Homework",
        body: "The algebra homework is due Monday.",
      }),
      profile,
    );
    const bulletin = classify(
      email({
        fromName: "School Office",
        fromEmail: "office@riverside.sch.uk",
        subject: "Weekly school bulletin",
        body: "School newsletter: the museum trip is confirmed. Unsubscribe is not a reason to file this elsewhere.",
      }),
      profile,
    );
    expect(homework.category).toBe("school");
    expect(homework.action).toBe("keep");
    expect(homework.protected).toBe(true);
    expect(bulletin.category).toBe("school");
    expect(bulletin.badge).toBe("SCHOOL");
    expect(bulletin.action).toBe("keep");
  });

  it("marks a buying enquiry as a new client lead", () => {
    const result = classify(
      email({
        fromName: "Tom Becker",
        fromEmail: "tom@beckerbake.example",
        subject: "Quote for a bakery website",
        body: "Could you design a website for the bakery? How much would it cost?",
      }),
      profile,
    );
    expect(result.category).toBe("new_client_lead");
    expect(result.badge).toBe("NEW CLIENT LEAD");
    expect(result.protected).toBe(true);
    expect(result.action).toBe("keep");
  });

  it("treats a school website enquiry as a lead, not as school mail", () => {
    const result = classify(
      email({
        fromName: "Helen Ward",
        fromEmail: "helen.ward@parents.example",
        subject: "Website for the PTA",
        body: "Could you design a website for our school PTA? What do you charge?",
      }),
      profile,
    );
    expect(result.category).toBe("new_client_lead");
  });

  it("marks saved clients, including others at the same company domain", () => {
    const exact = classify(
      email({
        fromName: "Anna Chen",
        fromEmail: "anna@harbourandco.example",
        subject: "Launch",
        body: "Can we move the homepage launch to Friday?",
      }),
      profile,
    );
    const colleague = classify(
      email({
        fromName: "Front of house",
        fromEmail: "hello@harbourandco.example",
        subject: "Menu",
        body: "Please add the Sunday menu.",
      }),
      profile,
    );
    expect(exact.category).toBe("client");
    expect(exact.badge).toBe("CLIENT");
    expect(colleague.category).toBe("client");
  });

  it("does not treat another gmail sender as a client", () => {
    const gmailProfile: Profile = {
      ...profile,
      knownClients: [{ name: "Sam", email: "sam.client@gmail.com" }],
    };
    const other = classify(
      email({
        fromEmail: "someone.else@gmail.com",
        subject: "Hello",
        body: "Just saying hello from another gmail address.",
      }),
      gmailProfile,
    );
    expect(other.category).not.toBe("client");
  });

  it("flags a suspicious message from a known client instead of deleting it", () => {
    const result = classify(
      email({
        fromName: "Anna Chen",
        fromEmail: "anna@harbourandco.example",
        subject: "Please verify your password",
        body: "Verify your password or the account will be closed.",
      }),
      profile,
    );
    expect(result.category).toBe("client");
    expect(result.badge).toBe("CLIENT");
    expect(result.protected).toBe(true);
    expect(result.action).toBe("review");
  });

  it("does not turn a newsletter that mentions quotes into a lead", () => {
    const result = classify(
      email({
        fromName: "Studio Index",
        fromEmail: "hello@studioindex.example",
        subject: "Quote of the day",
        body: "Newsletter. Quote of the day and website pricing ideas. Unsubscribe any time.",
      }),
      profile,
    );
    expect(result.category).toBe("newsletters");
    expect(result.action).toBe("archive");
  });

  it("archives receipts, finance, subscriptions, social, and account notices", () => {
    expect(
      classify(
        email({
          fromEmail: "auto-confirm@amazon.co.uk",
          subject: "Your order confirmation",
          body: "Thanks for your order. This receipt says it has been dispatched.",
        }),
        profile,
      ).category,
    ).toBe("receipts");
    expect(
      classify(
        email({
          fromEmail: "no-reply@hmrc.gov.uk",
          subject: "VAT return",
          body: "Your VAT return is due.",
        }),
        profile,
      ).category,
    ).toBe("finance");
    expect(
      classify(
        email({
          fromEmail: "no-reply@spotify.com",
          subject: "Premium",
          body: "Your subscription renews soon.",
        }),
        profile,
      ).category,
    ).toBe("subscriptions");
    expect(
      classify(
        email({
          fromEmail: "no-reply@instagram.com",
          subject: "Follower",
          body: "You have a new follower.",
        }),
        profile,
      ).category,
    ).toBe("social_media");
    expect(
      classify(
        email({
          fromEmail: "no-reply@accounts.google.com",
          subject: "New sign-in",
          body: "New sign-in from Chrome. This is a security alert.",
        }),
        profile,
      ).category,
    ).toBe("accounts");
  });

  it("moves obvious scams and unwanted pitches to spam without deleting them", () => {
    const scam = classify(
      email({
        fromEmail: "winner@claim-now.example",
        subject: "You have won",
        body: "You have won a bitcoin prize. Send your seed phrase.",
      }),
      profile,
    );
    const pitch = classify(
      email({
        fromEmail: "sales@rankfast.example",
        subject: "SEO",
        body: "We help businesses like yours. Buy our SEO package and act now.",
      }),
      profile,
    );
    expect(scam.category).toBe("spam");
    expect(scam.protected).toBe(false);
    expect(scam.action).toBe("spam");
    expect(pitch.category).toBe("spam");
  });

  it("flags a suspicious school-looking email instead of trashing it", () => {
    const result = classify(
      email({
        fromName: "Riverside IT",
        fromEmail: "support@riverside-login.example",
        subject: "School account password expires today",
        body: "Your school account will be closed. Verify your password to restore your account.",
      }),
      profile,
    );
    expect(result.category).toBe("review");
    expect(result.protected).toBe(true);
    expect(result.action).toBe("review");
    expect(result.important).toBe(true);
  });

  it("keeps a direct personal note and a GP reminder", () => {
    expect(
      classify(
        email({
          fromName: "Sarah Bennett",
          fromEmail: "sarah@family.example",
          subject: "Sunday",
          body: "Hi Ryan, lunch on Sunday is at 1. Can you pick up bread on the way?",
        }),
        profile,
      ).category,
    ).toBe("personal");
    expect(
      classify(
        email({
          fromEmail: "appointments@surgery.example",
          subject: "Reminder",
          body: "Your GP appointment is on Monday at 08:40.",
        }),
        profile,
      ).category,
    ).toBe("personal");
  });

  it("does not treat the word example as an exam", () => {
    const result = classify(
      email({
        fromEmail: "notes@reading.example",
        subject: "Example attached",
        body: "See the example attached when you have a moment to look.",
      }),
      profile,
    );
    expect(result.category).not.toBe("school");
    expect(result.action).toBe("review");
    expect(result.protected).toBe(true);
  });

  it("flags changed bank details instead of filing them as a normal invoice", () => {
    const result = classify(
      email({
        fromEmail: "bills@vendor-update.example",
        subject: "Bank details have changed",
        body: "Pay immediately. Our bank details have changed.",
      }),
      profile,
    );
    expect(result.category).toBe("review");
    expect(result.protected).toBe(true);
    expect(result.action).not.toBe("spam");
  });
});

describe("organiseMailbox", () => {
  it("files the sample mailbox and never deletes anything", () => {
    const { emails, report } = organiseMailbox(createSampleMailbox(), profile, "2026-11-07T18:05:00.000Z");
    expect(report.deleted).toBe(0);
    expect(emails.every((item) => item.folder !== "trash")).toBe(true);
    expect(report.school).toBeGreaterThanOrEqual(4);
    expect(report.leads.length).toBeGreaterThanOrEqual(3);
    expect(emails.find((item) => item.id === "homework")?.folder).toBe("inbox");
    expect(emails.find((item) => item.id === "self-notes")?.folder).toBe("inbox");
    expect(emails.find((item) => item.id === "client-harbour")?.badge).toBe("CLIENT");
    expect(emails.find((item) => item.id === "lead-bakery")?.badge).toBe("NEW CLIENT LEAD");
    expect(emails.find((item) => item.id === "phish-school")?.folder).toBe("inbox");
    expect(emails.find((item) => item.id === "phish-school")?.protected).toBe(true);
    expect(emails.find((item) => item.id === "crypto")?.folder).toBe("spam");
    expect(emails.find((item) => item.id === "newsletter")?.folder).toBe("archive");
    expect(emails.find((item) => item.id === "amazon")?.category).toBe("receipts");
  });

  it("leaves a message the user has already filed", () => {
    const [first] = createSampleMailbox();
    const held: StoredEmail = { ...first, userOverride: true, folder: "archive", category: "personal" };
    const { emails, report } = organiseMailbox([held], profile);
    expect(emails[0].folder).toBe("archive");
    expect(report.skipped).toBe(1);
  });
});

describe("removalBlockReason", () => {
  const base = createSampleMailbox()[0];

  it("blocks protected and uncertain mail until you specifically approve it", () => {
    const school: StoredEmail = { ...base, category: "school", protected: true, flaggedForReview: false };
    const lead: StoredEmail = { ...base, category: "new_client_lead", protected: true };
    const unfiled: StoredEmail = { ...base, category: null, protected: false };
    expect(removalBlockReason(school, false)).toMatch(/approve/i);
    expect(removalBlockReason(lead, false)).toMatch(/approve/i);
    expect(removalBlockReason(unfiled, false)).toMatch(/approve/i);
    expect(removalBlockReason(school, true)).toBeNull();
  });

  it("allows spam to be removed without the protected-mail approval", () => {
    const spam: StoredEmail = { ...base, category: "spam", protected: false, flaggedForReview: false, folder: "spam" };
    expect(removalBlockReason(spam, false)).toBeNull();
  });
});

describe("parseMail", () => {
  it("reads an eml message", () => {
    const parsed = parseEml(
      [
        "From: Tom Becker <tom@beckerbake.example>",
        "To: Ryan <ryan@rsdigital.example>",
        "Subject: Quote",
        "Date: Sat, 7 Nov 2026 12:00:00 +0000",
        "",
        "Could you design a website?",
      ].join("\n"),
    );
    expect(parsed.fromEmail).toBe("tom@beckerbake.example");
    expect(parsed.fromName).toBe("Tom Becker");
    expect(parsed.subject).toBe("Quote");
    expect(parsed.body).toContain("website");
    expect(parsed.date).toBe("2026-11-07T12:00:00.000Z");
  });

  it("reads a json export", () => {
    const parsed = parseMailJson(
      JSON.stringify([{ fromName: "Ada", fromEmail: "ada@example.com", subject: "Hello", body: "Hi", date: "2026-11-01T00:00:00.000Z" }]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].fromEmail).toBe("ada@example.com");
  });
});
