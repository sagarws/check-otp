// Self-contained Gmail IMAP reader — mirrors the logic from
// Automated-scripts/gmail-reader.js but lives inside this app so we have no
// runtime dependency on the sibling repo.

import Imap from "imap";
import { simpleParser } from "mailparser";

function getConfig() {
  const user = process.env.GMAIL_IMAP_USER;
  const password = process.env.GMAIL_IMAP_PASSWORD;
  if (!user || !password) {
    throw new Error(
      "GMAIL_IMAP_USER and GMAIL_IMAP_PASSWORD must be set in .env.local"
    );
  }
  return {
    user,
    password,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: {
      servername: "imap.gmail.com",
      rejectUnauthorized: false,
    },
  };
}

function buildCriteria(filters = {}) {
  const criteria = [];
  if (filters.from) criteria.push(["FROM", filters.from]);
  if (filters.to) criteria.push(["TO", filters.to]);
  if (filters.subject) criteria.push(["SUBJECT", filters.subject]);
  if (filters.bodyText) criteria.push(["BODY", filters.bodyText]);
  if (filters.since) criteria.push(["SINCE", new Date(filters.since)]);
  if (filters.before) criteria.push(["BEFORE", new Date(filters.before)]);
  if (filters.unseenOnly) criteria.push("UNSEEN");
  if (filters.seenOnly) criteria.push("SEEN");
  if (criteria.length === 0) criteria.push("ALL");
  return criteria;
}

export function fetchEmails(filters = {}) {
  const mailbox = filters.mailbox || "INBOX";
  const limit = Number.isFinite(filters.limit) ? filters.limit : 10;
  const criteria = buildCriteria(filters);

  return new Promise((resolve, reject) => {
    const imap = new Imap(getConfig());
    const emails = [];
    let pending = 0;
    let fetchEnded = false;

    const finish = (err) => {
      try { imap.end(); } catch (_) { /* noop */ }
      if (err) reject(err); else resolve(emails);
    };

    imap.once("ready", () => {
      imap.openBox(mailbox, true, (openErr) => {
        if (openErr) return finish(openErr);
        imap.search(criteria, (searchErr, uids) => {
          if (searchErr) return finish(searchErr);
          if (!uids || uids.length === 0) return finish();

          const wanted = uids.slice(-limit).reverse();
          const f = imap.fetch(wanted, { bodies: "", struct: true });

          f.on("message", (msg) => {
            pending++;
            msg.on("body", (stream) => {
              simpleParser(stream, (parseErr, parsed) => {
                if (parseErr) {
                  pending--;
                  if (fetchEnded && pending === 0) finish();
                  return;
                }
                emails.push({
                  from: parsed.from?.text || "",
                  to: parsed.to?.text || "",
                  subject: parsed.subject || "",
                  date: parsed.date || null,
                  text: parsed.text || "",
                  html: parsed.html || "",
                  messageId: parsed.messageId || "",
                });
                pending--;
                if (fetchEnded && pending === 0) finish();
              });
            });
          });

          f.once("error", finish);
          f.once("end", () => {
            fetchEnded = true;
            if (pending === 0) finish();
          });
        });
      });
    });

    imap.once("error", finish);
    imap.connect();
  });
}
