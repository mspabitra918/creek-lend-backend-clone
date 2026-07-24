import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
  campaignId = process.env.MAILERCLOUD_CAMPAIGN_ID,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  campaignId?: string;
}) {
  // MailerCloud rejects the mld-track-* headers unless a campaign id comes with
  // them, so tracking is only requested when one is configured.
  const headers = campaignId
    ? {
        "mld-track-campaign-id": campaignId,
        "mld-track-opens": "true",
        "mld-track-clicks": "true",
        "mld-track-inbox": "true",
      }
    : undefined;

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
      headers,
    });

    console.log("Email sent:", info.messageId);

    return info;
  } catch (err) {
    console.error("MailerCloud SMTP Error:", err);
    throw err;
  }
}
