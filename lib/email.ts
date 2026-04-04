import { sendEmail } from "@/lib/emailProvider";

type LegacyBookingEmailInput = {
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export async function sendConfirmation(
  email: string,
  booking: LegacyBookingEmailInput | null | undefined
) {
  const date = booking?.date || "";
  const start = booking?.start_time || "";
  const end = booking?.end_time || "";

  await sendEmail({
    to: email,
    subject: "Booking Confirmed",
    html: `
      <p>Your booking is confirmed.</p>
      <p>${date} ${start} to ${end}</p>
    `,
    text: `Your booking is confirmed.\n${date} ${start} to ${end}`.trim(),
  });
}
