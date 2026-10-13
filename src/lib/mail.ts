import "server-only";

// Sends an email through SendGrid's v3 API: the site check's and the booking
// page's. Needs SENDGRID_API_KEY, and the sender must be verified in SendGrid.
// Without the key under `next dev`, the message is logged instead.

export type Mail = {
  to: string;
  from: { email: string; name: string };
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { content: string; filename: string; type: string; disposition?: "attachment" | "inline" }[];
};

export async function sendMail(mail: Mail) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("SENDGRID_API_KEY isn’t set");
    console.log(`[mail] no SENDGRID_API_KEY; to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: mail.to }] }],
      from: mail.from,
      ...(mail.replyTo ? { reply_to: { email: mail.replyTo } } : {}),
      subject: mail.subject,
      content: [
        { type: "text/plain", value: mail.text },
        { type: "text/html", value: mail.html },
      ],
      ...(mail.attachments?.length
        ? { attachments: mail.attachments.map((a) => ({ disposition: "attachment", ...a })) }
        : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`SendGrid answered ${res.status}: ${await res.text()}`);
}
