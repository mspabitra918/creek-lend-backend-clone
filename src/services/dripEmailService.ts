import { sendMailgunEmail } from "./emailService";

/**
 * Templates for the 8-step bank-verification drip sequence. Copy escalates in
 * urgency as the application keeps sitting in `bank_verification_pending`.
 *
 * The CTA in every email is a one-click deep link to the bank verification
 * screen using the existing `?applicationId=` pattern (no separate borrower
 * auth/token system exists yet).
 */

export interface DripEmailDetails {
  applicationId: string;
  firstName: string;
  email: string;
  loanAmount: number;
}

interface DripTemplate {
  subject: string;
  heading: string;
  /** Accent colour for the heading + CTA button. */
  accent: string;
  /** Lead paragraph(s); plain strings rendered as <p>. */
  body: string[];
  ctaLabel: string;
}

const VERIFY_PATH = "/verify-bank";

const TEMPLATES: Record<number, DripTemplate> = {
  1: {
    subject:
      "Action Required: Verify your bank account to unlock your loan details",
    heading: "Verify your bank account to continue",
    accent: "#1a56db",
    body: [
      "Thank you for choosing Creek Lend! We have successfully received your loan application.",
      "To protect your identity and proceed with your application, we need to securely verify your bank account. Please note that your loan details are currently on hold until this step is completed.",
      "Once verified, our underwriting team will review your file to move forward with your funding.",
    ],
    ctaLabel: "Click Here to Verify Your Bank Account",
  },
  2: {
    subject: "Quick Reminder: Secure your Creek Lend application",
    heading: "Quick reminder",
    accent: "#1a56db",
    body: [
      "We noticed you started your application but haven't verified your bank account yet.",
      "Your application is safely saved, but we cannot process your loan terms or release funds until your account is linked. It only takes 2 minutes to complete.",
    ],
    ctaLabel: "Click Here to Complete Bank Verification",
  },
  3: {
    subject: "Running into trouble linking your bank? We can help.",
    heading: "Need a hand linking your bank?",
    accent: "#1a56db",
    body: [
      "We want to make sure your experience with Creek Lend is as smooth as possible. If you are having trouble connecting your online bank account, our team is here to assist you.",
      "Please return to your application to try again, or call your dedicated Loan Officer at (747) 206-1606 if you need manual assistance.",
    ],
    ctaLabel: "Click Here to Resume Application",
  },
  4: {
    subject: "Important: Complete your bank verification to avoid delays",
    heading: "Your application is still on hold",
    accent: "#f59e0b",
    body: [
      "Your Creek Lend application is still on hold. To prevent your file from being pushed back in our manual review queue, please complete your secure bank verification now.",
      "If you have already completed this step, please disregard this message as our system updates.",
    ],
    ctaLabel: "Verify Your Bank Account Here",
  },
  5: {
    subject: "Final reminder for today regarding your loan application",
    heading: "Final reminder for today",
    accent: "#f59e0b",
    body: [
      "As we wrap up today's processing cycle, your application is still missing your verified bank information.",
      "Don't miss out on your funding options. You can securely link your account from your phone or computer right now using the link below:",
    ],
    ctaLabel: "Securely Link Your Bank Account",
  },
  6: {
    subject: "Good morning! Let's finish your Creek Lend application",
    heading: "Good morning!",
    accent: "#f59e0b",
    body: [
      "We hope you're having a great morning. Your loan file is still resting on our dashboard waiting for bank verification.",
      "Let's get this finalized so our underwriters can review your account. Click the secure button below to jump straight back into the portal:",
    ],
    ctaLabel: "Complete Verification Screen",
  },
  7: {
    subject: "We're waiting on you: Finalize your bank link for funding",
    heading: "We're waiting on you",
    accent: "#f59e0b",
    body: [
      "Creek Lend specializes in working with unique financial backgrounds to provide the funding you need. However, we cannot offer approvals without a verified banking destination.",
      "Please take a moment to securely connect your account today so we can review your file.",
    ],
    ctaLabel: "Resume Bank Verification",
  },
  8: {
    subject: "Final Notice: Your Creek Lend application is expiring",
    heading: "Final notice",
    accent: "#dc2626",
    body: [
      "This is our final reminder. Because we haven't received your bank verification, your loan application is scheduled to expire.",
      "If your application expires, you will need to re-submit your lead and restart the entire process from scratch. Click below to save your progress and verify your account now:",
    ],
    ctaLabel: "Final Call: Verify Bank Account",
  },
};

export const DRIP_EMAIL_COUNT = Object.keys(TEMPLATES).length;

function renderDripEmail(
  template: DripTemplate,
  details: DripEmailDetails,
): string {
  const { applicationId, firstName, loanAmount } = details;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(loanAmount);

  const verifyUrl = `${process.env.FRONTEND_URL}${VERIFY_PATH}?applicationId=${applicationId}`;

  const paragraphs = template.body
    .map(
      (p) =>
        `<p style="color: #374151; font-size: 16px; line-height: 1.5;">${p}</p>`,
    )
    .join("\n");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #F0FFF4; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <img src="https://www.creeklend.com/logo-dark.png" alt="Creek Lend" style="height: 48px; width: 270px; display: block; margin: 0 auto 8px;" onerror="this.style.display='none'" />
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: ${template.accent}; margin-top: 0;">${template.heading}</h2>
        <p style="color: #374151; font-size: 16px;">Hello ${firstName},</p>
        ${paragraphs}
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Application ID</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${applicationId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Loan Amount</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${formattedAmount}</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${verifyUrl}" style="background: ${template.accent}; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">${template.ctaLabel}</a>
        </div>
        // <p style="color: #9ca3af; font-size: 13px; text-align: center;">
        //   Or copy this link into your browser:<br />
        //   <a href="${verifyUrl}" style="color: #1a56db; word-break: break-all;">${verifyUrl}</a>
        // </p>
        <p style="color: #374151; font-size: 16px; margin-top: 24px;">
          Best regards,<br />
          The Creek Lend Team
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <div style="text-align: center; padding: 10px 0;">
          <p style="color: #374151; font-size: 14px; margin: 5px 0;">
            <strong>Phone:</strong> <a href="tel:+17472061606" style="color: #1a56db; text-decoration: none;">(747) 206-1606</a>
          </p>
          <p style="color: #374151; font-size: 14px; margin: 5px 0;">
            <strong>Website:</strong> <a href="https://www.creeklend.com" style="color: #1a56db; text-decoration: none;">www.creeklend.com</a>
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This is an automated email from Creek Lend. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
}

/**
 * Sends drip email #`emailNumber` (1-8). The caller (worker) is responsible for
 * the kill-switch check and idempotency before invoking this.
 */
export async function sendDripEmail(
  emailNumber: number,
  details: DripEmailDetails,
): Promise<void> {
  const template = TEMPLATES[emailNumber];
  if (!template) {
    throw new Error(`No drip template for email #${emailNumber}`);
  }

  const html = renderDripEmail(template, details);
  await sendMailgunEmail(details.email, template.subject, html);
}
