export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getResendFromAddress() {
  return process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || "";
}

export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getResendFromAddress();

  if (!apiKey || !from) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM email configuration");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email provider request failed: ${response.status} ${body}`);
  }

  return response.json().catch(() => null);
}
