# Post Room

Post Room files a mailbox for RS Digital Services. School, personal mail, existing clients, and new enquiries stay in the inbox and are protected. Receipts, finance, subscriptions, and newsletters are labelled and archived. Obvious spam is moved, not deleted.

This copy starts with a **sample mailbox**. It is not a live Gmail, Outlook, or IMAP inbox. Add real messages with `.eml` or JSON, or paste one message, then organise them with the same rules.

## Run it

```bash
npm install
npm test
npm run dev
```

Open the local address Vite prints. `npm run build` typechecks and builds the static app.

## How mail is filed

- Mail from your own addresses is **Personal**.
- Teachers, school domains, homework, exams, timetables, and school announcements are **School**.
- Saved customers are marked **CLIENT**. Someone asking to buy or book RS Digital Services is marked **NEW CLIENT LEAD**.
- Finance, accounts, subscriptions, receipts, social notifications, and newsletters are labelled and taken out of the inbox.
- Phishing, scams, and unwanted advertising go to **Spam**.
- Anything uncertain, or suspicious but possibly important, is **flagged for review** and left in the inbox.

Personal, school, client, lead, and uncertain messages cannot be deleted unless you specifically approve it. Organise never deletes mail.

## Settings

Add your real email addresses, school domains, and existing clients in Settings, then choose **Organise again**. Messages you file yourself are left as you set them until you choose **Let organise decide**.

## Import

JSON messages look like this:

```json
[
  {
    "fromName": "Tom Becker",
    "fromEmail": "tom@bakery.example",
    "subject": "Quote for a website",
    "body": "Could you design a website? How much would it cost?",
    "date": "2026-11-07T12:00:00.000Z"
  }
]
```

`.eml` files exported from Gmail or Outlook work as well.
