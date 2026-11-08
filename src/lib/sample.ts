import type { IncomingEmail, Settings } from "../types";

export function sampleEmails(settings: Settings): IncomingEmail[] {
  const me = settings.ownerEmails[0] ?? "ryan@rsdigital.example";
  const name = settings.ownerName || "Ryan";
  return [
    {
      messageId: "<sample-self@local>",
      fromName: name,
      fromEmail: me,
      toEmail: me,
      subject: "Notes for the Henderson proposal",
      bodyText:
        "Keep the homepage shorter and lead with the booking form. Send the revised quote on Monday.",
      date: "2026-11-07T09:10:00.000Z",
    },
    {
      messageId: "<sample-dinner@local>",
      fromName: "Sam Okonkwo",
      fromEmail: "sam.okonkwo@personal.example",
      toEmail: me,
      subject: "Dinner Thursday?",
      bodyText: `Hi ${name}, are you free Thursday after six? There's a table at the place on the high street if you are.`,
      date: "2026-11-06T18:22:00.000Z",
    },
    {
      messageId: "<sample-essay@local>",
      fromName: "Mrs Patel",
      fromEmail: "mrs.patel@oakfield.example",
      toEmail: me,
      subject: "Year 10 history essay deadline",
      bodyText:
        "Please remember the history essay is due on Friday. Submit it before the afternoon lesson. Mrs Patel",
      date: "2026-11-06T08:05:00.000Z",
    },
    {
      messageId: "<sample-timetable@local>",
      fromName: "Oakfield School Office",
      fromEmail: "office@oakfield.example",
      toEmail: me,
      subject: "Timetable change for Monday",
      bodyText:
        "Monday period 2 is now in room B12. The rest of the timetable is unchanged. School office.",
      date: "2026-11-05T16:40:00.000Z",
    },
    {
      messageId: "<sample-mocks@local>",
      fromName: "Exams Office",
      fromEmail: "exams@oakfield.example",
      toEmail: me,
      subject: "Mock exam timetable",
      bodyText:
        "The mock exam timetable is attached in this note. English is Tuesday at 09:00. Maths is Wednesday at 09:00. Arrive 15 minutes early.",
      date: "2026-11-04T11:15:00.000Z",
    },
    {
      messageId: "<sample-sports@local>",
      fromName: "Oakfield School Office",
      fromEmail: "notices@oakfield.example",
      toEmail: me,
      subject: "Sports day arrangements",
      bodyText:
        "Sports day is next Thursday. Meet on the field at 09:10. Bring trainers and a water bottle. School announcement.",
      date: "2026-11-03T12:00:00.000Z",
    },
    {
      messageId: "<sample-client@local>",
      fromName: "Hannah Greenfield",
      fromEmail: "hannah@greenfieldstudio.example",
      toEmail: me,
      subject: "Can we move Friday's call?",
      bodyText:
        "The photos will not be ready until the afternoon. Could we move our project call to 16:00? Thanks, Hannah",
      date: "2026-11-07T08:44:00.000Z",
    },
    {
      messageId: "<sample-cafe@local>",
      fromName: "Tom Adeyemi",
      fromEmail: "tom@harbourcafe.example",
      toEmail: me,
      subject: "Quote for a cafe website",
      bodyText:
        "Hello, I would like a quote for a five-page website for my cafe. We need a menu, opening hours, and a booking form. What do you charge?",
      date: "2026-11-07T07:30:00.000Z",
    },
    {
      messageId: "<sample-booking@local>",
      fromName: "Priya Shah",
      fromEmail: "priya.shah@mailbox.example",
      toEmail: me,
      subject: "Booking a brand refresh",
      bodyText:
        `Hi, I am looking for someone to refresh a small brand. Could you tell me your availability for a new project with ${settings.businessName}?`,
      date: "2026-11-06T14:12:00.000Z",
    },
    {
      messageId: "<sample-bank@local>",
      fromName: "Northbank",
      fromEmail: "statements@northbank.example",
      toEmail: me,
      subject: "Your November statement is ready",
      bodyText:
        "Your account statement for November is ready in online banking. This message does not ask you to click a link.",
      date: "2026-11-02T07:00:00.000Z",
    },
    {
      messageId: "<sample-signin@local>",
      fromName: "Mail security",
      fromEmail: "no-reply@mail.example",
      toEmail: me,
      subject: "New sign-in to your email",
      bodyText:
        "There was a new sign-in to your email from London. If this was you, you can ignore this security alert.",
      date: "2026-11-06T21:05:00.000Z",
    },
    {
      messageId: "<sample-phish@local>",
      fromName: "Oakfield School IT",
      fromEmail: "support@oakfield-portal.example",
      toEmail: me,
      subject: "Your school password expires today",
      bodyText:
        "Your school account password will expire today. Verify now: http://bit.ly/school-login",
      date: "2026-11-07T06:12:00.000Z",
    },
    {
      messageId: "<sample-bitcoin@local>",
      fromName: "Alex Morgan",
      fromEmail: "alex.morgan@mailbolt.example",
      toEmail: me,
      subject: "I want to book a website",
      bodyText:
        "I want to book a website this week. I will pay the deposit in bitcoin. Kindly send your crypto wallet.",
      date: "2026-11-05T19:48:00.000Z",
    },
    {
      messageId: "<sample-receipt@local>",
      fromName: "Market Lane",
      fromEmail: "receipts@marketlane.example",
      toEmail: me,
      subject: "Your receipt from Market Lane",
      bodyText: "Thanks for your order. Your receipt total is £24.50. The parcel has been dispatched.",
      date: "2026-11-01T13:20:00.000Z",
    },
    {
      messageId: "<sample-sub@local>",
      fromName: "Streamly",
      fromEmail: "billing@streamly.example",
      toEmail: me,
      subject: "Your subscription renews on 20 November",
      bodyText: "Your Streamly plan renews on 20 November. Your subscription price is unchanged.",
      date: "2026-11-01T09:00:00.000Z",
    },
    {
      messageId: "<sample-social@local>",
      fromName: "Picta",
      fromEmail: "notify@picta.example",
      toEmail: me,
      subject: "Sam liked your photo",
      bodyText: "Sam liked your photo from the studio shoot. Open Picta to see the comment.",
      date: "2026-11-04T17:41:00.000Z",
    },
    {
      messageId: "<sample-news@local>",
      fromName: "Design Weekly",
      fromEmail: "news@designweekly.example",
      toEmail: me,
      subject: "Design Weekly: quiet websites",
      bodyText:
        "This week's newsletter looks at quiet websites. View this in your browser. Unsubscribe from Design Weekly.",
      date: "2026-11-03T08:00:00.000Z",
    },
    {
      messageId: "<sample-seo@local>",
      fromName: "Rankblast Growth",
      fromEmail: "growth@rankblast.example",
      toEmail: me,
      subject: "80% off backlinks",
      bodyText:
        "We offer 80% off backlinks for a limited time. Boost your traffic. Unsubscribe from these offers.",
      date: "2026-11-02T15:16:00.000Z",
    },
    {
      messageId: "<sample-casino@local>",
      fromName: "Prize Desk",
      fromEmail: "winner@luckyspins.example",
      toEmail: me,
      subject: "You have been selected",
      bodyText: "You have been selected as a casino lottery winner. Claim the prize now.",
      date: "2026-10-30T11:11:00.000Z",
    },
    {
      messageId: "<sample-vat@local>",
      fromName: "Ledger and Co",
      fromEmail: "accounts@ledgerandco.example",
      toEmail: me,
      subject: "VAT return reminder",
      bodyText: "This is a reminder that the VAT return is due next week. Send the receipts when you can.",
      date: "2026-11-04T09:30:00.000Z",
    },
  ];
}
