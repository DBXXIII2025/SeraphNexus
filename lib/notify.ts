import { sendEmail } from "@/lib/emailProvider";

export async function sendBookingEmail({
  to,
  subject,
  message,
}: {
  to: string;
  subject: string;
  message: string;
}) {
  if (!to) return;

  try {
    await sendEmail({
      to,
      subject,
      html: `<p>${message}</p>`,
      text: message,
    });
  } catch (err) {
    console.error("Email error:", err);
  }
}

export async function sendBookingSMS({
  to,
  message,
}: {
  to: string;
  message: string;
}) {
  if (!to) return;

  try {
    console.log("SMS:", to, message);
    // Plug Twilio here later
  } catch (err) {
    console.error("SMS error:", err);
  }
}
