import { Router, Request, Response } from "express";
import { rateLimit } from "../auth";
import { applicationSchema, sanitizeInput } from "../validation";
import {
  createApplication,
  checkDuplicateSSN,
} from "../services/applicationService";
import { trackLeadEvent } from "../services/metaCapi";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// POST /api/apply — Submit loan application
router.post("/", async (req: Request, res: Response) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";

    // Validate request body
    const parsed = applicationSchema.safeParse(req.body);
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

    // Check for duplicate SSN
    try {
      const isDuplicate = await checkDuplicateSSN(body.ssn);
      if (isDuplicate) {
        res.status(409).json({
          error:
            "An application with this SSN already exists. Please contact support if you need to update your application.",
        });
        return;
      }
    } catch (dbError) {
      console.warn(
        "Database not available, skipping duplicate check:",
        dbError,
      );
    }

    // Insert into database
    let applicationId: string;
    try {
      const result = await createApplication({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        ssn: body.ssn,
        driverLicenseNumber: body.driverLicenseNumber,
        driverLicenseState: body.driverLicenseState,
        streetAddress: body.streetAddress,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        country: body.country,
        employmentStatus: body.employmentStatus,
        employerName: body.employerName,
        jobTitle: body.jobTitle,
        monthlyIncome: body.monthlyIncome,
        yearsEmployed: body.yearsEmployed,
        loanAmount: body.loanAmount,
        loanPurpose: body.loanPurpose,
        loanTerm: body.loanTerm,
        bankName: body.bankName,
        accountNumber: body.accountNumber,
        routingNumber: body.routingNumber,
        accountType: body.accountType,
        utmSource: body.utmSource,
        utmMedium: body.utmMedium,
        utmCampaign: body.utmCampaign,
        utmContent: body.utmContent,
        tcpaConsent: true,
        privacyConsent: true,
        creditCheckConsent: true,
        ipAddress: ip,
        userAgent,
        leadId: body.leadId,
      });
      applicationId = result.id;
    } catch (dbError) {
      console.error("Database insert failed:", dbError);
      if (process.env.NODE_ENV === "development") {
        applicationId = uuidv4();
        console.log(`[DEV] Mock application created: ${applicationId}`);
      } else {
        res
          .status(500)
          .json({ error: "Failed to process application. Please try again." });
        return;
      }
    }

    // Fire Meta CAPI event (non-blocking)
    trackLeadEvent({
      email: body.email,
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
      ipAddress: ip,
      userAgent,
      loanAmount: body.loanAmount,
      loanPurpose: body.loanPurpose,
      sourceUrl: req.headers.referer || undefined,
    }).catch((err) => console.error("Meta CAPI error:", err));

    console.log(`Application submitted: ${applicationId}`);

    res.json({
      success: true,
      applicationId,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Application submission error:", error);
    res
      .status(500)
      .json({ error: "An internal error occurred. Please try again." });
  }
});

export default router;
