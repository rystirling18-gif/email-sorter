import { describe, expect, it } from "vitest";
import { classify } from "./classify";
import { filterMessages, matchesFolder } from "./folders";
import { messageFromIncoming, organiseMessage } from "./organise";
import { parseEml } from "./parseEml";
import { deletionDecision, spamDecision } from "./safety";
import { sampleEmails } from "./sample";
import { DEFAULT_SETTINGS, type IncomingEmail } from "../types";

function mail(partial: Partial<IncomingEmail> & Pick<IncomingEmail, "subject" | "bodyText" | "fromEmail">): IncomingEmail {
  return {
    messageId: partial.messageId ?? "<t@local>",
    fromName: partial.fromName ?? "Sender",
    fromEmail: partial.fromEmail,
    toEmail: partial.toEmail ?? "ryan@rsdigital.example",
    subject: partial.subject,
    bodyText: partial.bodyText,
    date: partial.date ?? "2026-11-07T12:00:00.000Z",
  };
}

describe("classify sample mailbox", () => {
  const expected: Record<string, { category: string; lock: string | null; action: string }> = {
    "<sample-self@local>": { category: "personal", lock: "self", action: "keep_inbox" },
    "<sample-dinner@local>": { category: "personal", lock: "personal", action: "keep_inbox" },
    "<sample-essay@local>": { category: "school", lock: "school", action: "keep_inbox" },
    "<sample-timetable@local>": { category: "school", lock: "school", action: "keep_inbox" },
    "<sample-mocks@local>": { category: "school", lock: "school", action: "keep_inbox" },
    "<sample-sports@local>": { category: "school", lock: "school", action: "keep_inbox" },
    "<sample-client@local>": { category: "client", lock: "client", action: "keep_inbox" },
    "<sample-cafe@local>": { category: "new_client_lead", lock: "lead", action: "keep_inbox" },
    "<sample-booking@local>": { category: "new_client_lead", lock: "lead", action: "keep_inbox" },
    "<sample-bank@local>": { category: "finance", lock: null, action: "keep_inbox" },
    "<sample-signin@local>": { category: "accounts", lock: null, action: "keep_inbox" },
    "<sample-phish@local>": { category: "review", lock: "uncertain", action: "review" },
    "<sample-bitcoin@local>": { category: "review", lock: "lead", action: "review" },
    "<sample-receipt@local>": { category: "receipts", lock: null, action: "archive" },
    "<sample-sub@local>": { category: "subscriptions", lock: null, action: "archive" },
    "<sample-social@local>": { category: "social", lock: null, action: "archive" },
    "<sample-news@local>": { category: "newsletters", lock: null, action: "archive" },
    "<sample-seo@local>": { category: "spam", lock: null, action: "spam" },
    "<sample-casino@local>": { category: "spam", lock: null, action: "spam" },
    "<sample-vat@local>": { category: "finance", lock: null, action: "keep_inbox" },
  };

  it("files every sample the way the safety rules require", () => {
    for (const email of sampleEmails(DEFAULT_SETTINGS)) {
      const filing = classify(email, DEFAULT_SETTINGS);
      const want = expected[email.messageId];
      expect(want, email.messageId).toBeTruthy();
      expect(filing.category, email.messageId).toBe(want.category);
      expect(filing.safetyLock, email.messageId).toBe(want.lock);
      expect(filing.action, email.messageId).toBe(want.action);
    }
  });

  it("marks new enquiries and existing customers with the required labels", () => {
    const messages = sampleEmails(DEFAULT_SETTINGS).map((email) => messageFromIncoming(email, DEFAULT_SETTINGS, { sample: true }));
    const cafe = messages.find((message) => message.messageId === "<sample-cafe@local>");
    const client = messages.find((message) => message.messageId === "<sample-client@local>");
    expect(cafe?.labels).toContain("NEW CLIENT LEAD");
    expect(client?.labels).toContain("CLIENT");
    expect(cafe?.spam).toBe(false);
    expect(client?.inInbox).toBe(true);
  });
});

describe("edge cases", () => {
  it("keeps homework from a teacher on a personal address", () => {
    const filing = classify(
      mail({
        fromName: "Mr Davies",
        fromEmail: "davies.homework@gmail.example",
        subject: "Coursework draft",
        bodyText: "Please send the coursework draft before Thursday's lesson.",
      }),
      DEFAULT_SETTINGS,
    );
    expect(filing.category).toBe("school");
    expect(filing.safetyLock).toBe("school");
  });

  it("does not treat a sales blast as a new client lead", () => {
    const filing = classify(
      mail({
        fromName: "Growth Team",
        fromEmail: "news@rankblast.example",
        subject: "How much do you charge for ads?",
        bodyText: "How much do you charge for ads? We offer a cheaper package. Unsubscribe.",
      }),
      DEFAULT_SETTINGS,
    );
    expect(filing.category).toBe("spam");
    expect(filing.labels).not.toContain("NEW CLIENT LEAD");
  });

  it("keeps a .sch.uk exam email even when the domain is not saved in settings", () => {
    const filing = classify(
      mail({
        fromName: "Exams",
        fromEmail: "exams@riverbank.sch.uk",
        subject: "Exam timetable",
        bodyText: "The summer exam timetable is now published.",
      }),
      { ...DEFAULT_SETTINGS, schoolDomains: [] },
    );
    expect(filing.category).toBe("school");
    expect(filing.safetyLock).toBe("school");
  });

  it("flags an unknown direct email for review instead of deleting it", () => {
    const filing = classify(
      mail({
        fromName: "Jordan",
        fromEmail: "jordan@elsewhere.example",
        subject: "Hello",
        bodyText: "Just sending a note with no other context.",
      }),
      DEFAULT_SETTINGS,
    );
    expect(filing.action).toBe("review");
    expect(filing.safetyLock).toBe("uncertain");
  });
});

describe("safety gates", () => {
  const messages = sampleEmails(DEFAULT_SETTINGS).map((email) =>
    messageFromIncoming(email, DEFAULT_SETTINGS, { sample: true }),
  );
  const byId = (id: string) => messages.find((message) => message.messageId === id)!;

  it("never deletes mail from you, school, clients, or possible clients", () => {
    for (const id of ["<sample-self@local>", "<sample-essay@local>", "<sample-client@local>", "<sample-cafe@local>", "<sample-bitcoin@local>", "<sample-phish@local>"]) {
      expect(deletionDecision(byId(id), { confirmed: true, schoolApproved: true, typed: "DELETE" }).allowed).toBe(id === "<sample-essay@local>");
    }
  });

  it("requires a specific approval before a school email can be deleted", () => {
    const school = byId("<sample-essay@local>");
    expect(deletionDecision(school).allowed).toBe(false);
    expect(deletionDecision(school, { schoolApproved: true }).allowed).toBe(false);
    expect(deletionDecision(school, { schoolApproved: true, typed: "DELETE" }).allowed).toBe(true);
  });

  it("does not move protected or important mail to spam", () => {
    expect(spamDecision(byId("<sample-client@local>")).allowed).toBe(false);
    expect(spamDecision(byId("<sample-cafe@local>")).allowed).toBe(false);
    expect(spamDecision(byId("<sample-essay@local>")).allowed).toBe(false);
    expect(spamDecision(byId("<sample-bank@local>")).allowed).toBe(false);
    expect(spamDecision(byId("<sample-phish@local>")).allowed).toBe(false);
    expect(spamDecision(byId("<sample-phish@local>"), { confirmedUnimportant: true }).allowed).toBe(true);
    expect(spamDecision(byId("<sample-news@local>")).allowed).toBe(true);
  });

  it("keeps a restored spam message when rules run again", () => {
    const spam = byId("<sample-casino@local>");
    const restored = organiseMessage(
      { ...spam, spam: false, inInbox: true, review: true, manualOverride: true, safetyLock: "uncertain", category: "review" },
      DEFAULT_SETTINGS,
    );
    expect(restored.spam).toBe(false);
    expect(restored.inInbox).toBe(true);
  });
});

describe("folders", () => {
  it("keeps school, leads, and clients easy to find", () => {
    const messages = sampleEmails(DEFAULT_SETTINGS).map((email) => messageFromIncoming(email, DEFAULT_SETTINGS));
    expect(filterMessages(messages, "school", "").length).toBeGreaterThanOrEqual(4);
    expect(filterMessages(messages, "leads", "cafe").map((message) => message.subject)).toEqual(["Quote for a cafe website"]);
    expect(filterMessages(messages, "clients", "").every((message) => message.labels.includes("CLIENT") || message.category === "client")).toBe(true);
    const phish = messages.find((message) => message.messageId === "<sample-phish@local>")!;
    expect(matchesFolder(phish, "review")).toBe(true);
    expect(matchesFolder(phish, "school")).toBe(true);
    expect(matchesFolder(phish, "spam")).toBe(false);
  });
});

describe("parseEml", () => {
  it("reads a plain email", () => {
    const parsed = parseEml(`From: Tom Adeyemi <tom@harbourcafe.example>\r\nTo: Ryan <ryan@rsdigital.example>\r\nSubject: Quote for a cafe website\r\nDate: Fri, 7 Nov 2026 07:30:00 +0000\r\nMessage-ID: <cafe@local>\r\n\r\nI would like a quote for a website.\r\n`);
    expect(parsed.fromEmail).toBe("tom@harbourcafe.example");
    expect(parsed.fromName).toBe("Tom Adeyemi");
    expect(parsed.subject).toBe("Quote for a cafe website");
    expect(parsed.bodyText).toContain("quote for a website");
    expect(classify(parsed, DEFAULT_SETTINGS).category).toBe("new_client_lead");
  });

  it("decodes a multipart email and an encoded subject", () => {
    const parsed = parseEml(`From: Exams Office <exams@riverbank.sch.uk>\r\nTo: ryan@rsdigital.example\r\nSubject: =?UTF-8?B?RXhhbSB0aW1ldGFibGU=?=\r\nDate: Fri, 7 Nov 2026 09:00:00 +0000\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="bound"\r\n\r\n--bound\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThe exam timetable is ready.\r\n--bound\r\nContent-Type: text/html\r\n\r\n<p>Ignore the html</p>\r\n--bound--\r\n`);
    expect(parsed.subject).toBe("Exam timetable");
    expect(parsed.bodyText).toContain("exam timetable is ready");
    expect(classify(parsed, DEFAULT_SETTINGS).category).toBe("school");
  });
});
