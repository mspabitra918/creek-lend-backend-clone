interface ApplicationDetails {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  loanAmount: number;
  loanPurpose: string;
  loanTerm: number;
}

async function sendMailgunEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM || `mailgun@${domain}`;
  const baseUrl = process.env.MAILGUN_API_URL || "https://api.mailgun.net";

  if (!apiKey || !domain) {
    throw new Error("Mailgun API key or domain not configured");
  }

  const form = new URLSearchParams();
  form.append("from", from);
  form.append("to", to);
  form.append("subject", subject);
  form.append("html", html);

  const response = await fetch(`${baseUrl}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mailgun API error (${response.status}): ${errorBody}`);
  }
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
        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/verify-bank" style="background: #1a56db; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">Verify Bank Account</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <div style="text-align: center; padding: 10px 0;">
          <p style="color: #374151; font-size: 14px; margin: 5px 0;">
            <strong>Phone:</strong> <a href="tel:+17472005228" style="color: #1a56db; text-decoration: none;">(747) 200-5228</a>
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

  await sendMailgunEmail(
    email,
    `Application Received - ID: ${applicationId} | Creek Lend`,
    html,
  );
}

interface StatusUpdateDetails {
  applicationId: string;
  firstName: string;
  email: string;
  loanAmount: number;
  status: string;
}

const statusConfig: Record<
  string,
  { title: string; message: string; color: string; icon: string }
> = {
  bank_verification_pending: {
    title: "Bank Verification Required",
    message:
      "Your loan application has been received. Please complete the bank verification process to proceed with your application.",
    color: "#f59e0b",
    icon: "&#127974;",
  },
  bank_verification_in_progress: {
    title: "Bank Verification In Progress",
    message:
      "Your bank verification is currently being processed. Please allow some time for us to verify your bank account details. We will notify you once the verification is complete.",
    color: "#2563eb",
    icon: "&#9203;",
  },
  bank_verification_completed: {
    title: "Bank Verification Completed",
    message:
      "Your bank verification has been successfully completed. Your application is now being prepared for review by our team.",
    color: "#16a34a",
    icon: "&#9989;",
  },
  bank_verification_failed: {
    title: "Bank Verification Failed",
    message:
      "Unfortunately, we were unable to verify your bank account. Please re-submit your bank verification with correct credentials to continue with your loan application.",
    color: "#dc2626",
    icon: "&#9888;",
  },
  reviewing: {
    title: "Application Under Review",
    message:
      "Your loan application is currently being reviewed by our team. We will notify you once a decision has been made.",
    color: "#2563eb",
    icon: "&#128269;",
  },
  approved: {
    title: "Application Approved!",
    message:
      "Congratulations! Your loan application has been approved. Our team will be in touch shortly with the next steps to finalize your loan.",
    color: "#16a34a",
    icon: "&#9989;",
  },
  declined: {
    title: "Application Update",
    message:
      "After careful review, we are unable to approve your loan application at this time. If you have any questions, please don't hesitate to contact our support team.",
    color: "#dc2626",
    icon: "&#10060;",
  },
  funded: {
    title: "Loan Funded!",
    message:
      "Great news! Your loan has been funded and the funds will be deposited into your bank account. Please allow 1-3 business days for the transfer to complete.",
    color: "#16a34a",
    icon: "&#128176;",
  },
  pending: {
    title: "Application Pending",
    message:
      "Your application is now pending review. Our team will begin reviewing your application shortly.",
    color: "#f59e0b",
    icon: "&#9203;",
  },
};

export async function sendStatusUpdateEmail(
  details: StatusUpdateDetails,
): Promise<void> {
  const { applicationId, firstName, email, loanAmount, status } = details;

  const config = statusConfig[status];
  if (!config) return; // No email for statuses like bank_verification_pending/completed

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(loanAmount);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a56db; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Creek Lend</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 48px;">${config.icon}</span>
        </div>
        <h2 style="color: ${config.color}; margin-top: 0; text-align: center;">${config.title}</h2>
        <p style="color: #374151; font-size: 16px;">
          Hi ${firstName},
        </p>
        <p style="color: #374151; font-size: 16px;">
          ${config.message}
        </p>
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
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Status</td>
              <td style="padding: 8px 0; font-size: 14px; font-weight: bold; text-align: right;">
                <span style="background: ${config.color}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px;">${status.replace(/_/g, " ").toUpperCase()}</span>
              </td>
            </tr>
          </table>
        </div>
        <p style="color: #374151; font-size: 14px;">
          You can check your application status at any time using your Application ID <strong>${applicationId}</strong>.
        </p>
        ${status === "bank_verification_failed" ? `<div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/verify-bank" style="background: #1a56db; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">Verify Bank Account</a>
        </div>` : ""}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <div style="text-align: center; padding: 10px 0;">
          <p style="color: #374151; font-size: 14px; margin: 5px 0;">
            <strong>Phone:</strong> <a href="tel:+17472005228" style="color: #1a56db; text-decoration: none;">(747) 200-5228</a>
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

  await sendMailgunEmail(
    email,
    `${config.title} - ID: ${applicationId} | Creek Lend`,
    html,
  );
}
