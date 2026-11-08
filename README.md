# Sorter

Local inbox organiser for personal mail, school mail, and RS Digital Services.

Messages stay in this browser. The app files them into folders, keeps important mail in the inbox, and moves obvious junk to spam. It does not delete personal, school, client, or possible client mail on its own.

## Run it

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. The first view is sample mail so the folders are visible before you import anything.

```bash
npm test
npm run build
```

## What it files

- **Personal** and mail from your own addresses stay protected.
- **School** mail, including `.sch.uk` addresses and teacher messages about homework, exams, timetables, and deadlines, stays protected. A school email can be deleted only if you specifically approve that message.
- People asking to buy from the business are marked **NEW CLIENT LEAD**. Saved customers are marked **CLIENT**. Neither is deleted.
- Finance and account notices stay in the inbox. Receipts, subscriptions, social notifications, and newsletters are archived into their folders.
- Obvious spam and unwanted advertising go to spam. Suspicious mail that might still be important is flagged for review and kept.

Change your addresses, school domains, and known clients in **Settings**, then save. The mailbox is filed again from those lists.

## Bring in real mail

- **Import** reads `.eml` files or one pasted raw message.
- **Sync mailbox** reads the latest inbox over IMAP when a local `.env` exists:

```bash
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_USER=you@example.com
IMAP_PASSWORD=your-password
```

Restart `npm run dev` after changing `.env`. The password is read on this computer. It is not typed into the page and it is not stored in the mailbox.
