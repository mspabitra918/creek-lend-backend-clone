import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface ApplicationDetails {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  loanAmount: number;
  loanPurpose: string;
  loanTerm: number;
}

export async function sendApplicationConfirmationEmail(
  details: ApplicationDetails,
): Promise<void> {
  const {
    applicationId,
    firstName,
    lastName,
    email,
    loanAmount,
    loanPurpose,
    loanTerm,
  } = details;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(loanAmount);

  const purposeLabel = loanPurpose
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a56db; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Creek Lend</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2 style="color: #111827; margin-top: 0;">Application Received!</h2>
        <p style="color: #374151; font-size: 16px;">
          Hi ${firstName},
        </p>
        <p style="color: #374151; font-size: 16px;">
          Thank you for submitting your loan application. We have received your application and it is now being processed.
        </p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #111827; margin-top: 0;">Application Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Application ID</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${applicationId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Applicant Name</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${firstName} ${lastName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Loan Amount</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: bold; text-align: right;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Loan Purpose</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${purposeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Loan Term</td>
              <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${loanTerm} months</td>
            </tr>
          </table>
        </div>
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">
            <strong>Next Step:</strong> Please complete the bank verification process to proceed with your application.
          </p>
        </div>
        <p style="color: #374151; font-size: 14px;">
          Please save your Application ID <strong>${applicationId}</strong> for future reference. You can use it to check your application status at any time.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This is an automated email from Creek Lend. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Application Received - ID: ${applicationId} | Creek Lend`,
    html,
  });
}
