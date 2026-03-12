import { Router, Request, Response } from "express";
import { requireAuth, rateLimit, AuthRequest } from "../auth";
import {
  authenticateAdmin,
  createAdminUser,
  verifyToken,
  getAdminById,
} from "../services/adminService";
import {
  listApplications,
  getApplicationById,
  getApplicationByIdDecrypted,
  updateApplicationStatus,
  deleteApplication,
  getApplicationStats,
  getAuditLog,
} from "../services/applicationService";

const router = Router();

// POST /api/admin/auth — Login
router.post("/auth", async (req: Request, res: Response) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";

    const rl = rateLimit(`login:${ip}`, 5, 60000);
    if (!rl.allowed) {
      res
        .status(429)
        .set("Retry-After", String(Math.ceil(rl.resetIn / 1000)))
        .json({ error: "Too many login attempts. Try again later." });
      return;
    }

    const { email, password, action, setupKey, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Bootstrap: create first admin user
    if (action === "setup" && process.env.ADMIN_SETUP_KEY) {
      if (setupKey !== process.env.ADMIN_SETUP_KEY) {
        res.status(403).json({ error: "Invalid setup key" });
        return;
      }

      const user = await createAdminUser(
        email,
        password,
        name || "Admin",
        "admin",
      );
      res.json({
        success: true,
        user,
        message: "Admin user created. You can now log in.",
      });
      return;
    }

    const result = await authenticateAdmin(email, password);
    if (!result) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.json({
      success: true,
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/auth — Verify token / get current user
router.get("/auth", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const user = await getAdminById(payload.userId);
    if (!user || !user.is_active) {
      res.status(403).json({ error: "Account not found or deactivated" });
      return;
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Token verify error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/applications — List all applications
router.get(
  "/applications",
  requireAuth(),
  async (req: AuthRequest, res: Response) => {
    try {
      const options = {
        status: (req.query.status as string) || undefined,
        country: (req.query.country as string) || undefined,
        search: (req.query.search as string) || undefined,
        page: parseInt((req.query.page as string) || "1", 10),
        limit: Math.min(parseInt((req.query.limit as string) || "20", 10), 100),
        sortBy: (req.query.sortBy as string) || "created_at",
        sortOrder: ((req.query.sortOrder as string) || "desc") as
          | "asc"
          | "desc",
      };

      const result = await listApplications(options);

      // Strip encrypted fields from list view
      const safeApplications = result.applications.map((app) => ({
        id: app.id,
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        phone: app.phone,
        date_of_birth: app.date_of_birth,
        dl_state: app.dl_state,
        city: app.city,
        state: app.state,
        zip_code: app.zip_code,
        country: app.country,
        employment_status: app.employment_status,
        employer_name: app.employer_name,
        job_title: app.job_title,
        monthly_income: app.monthly_income,
        years_employed: app.years_employed,
        loan_amount: app.loan_amount,
        loan_purpose: app.loan_purpose,
        loan_term: app.loan_term,
        bank_name: app.bank_name,
        routing_number: app.routing_number,
        account_type: app.account_type,
        utm_source: app.utm_source,
        utm_medium: app.utm_medium,
        utm_campaign: app.utm_campaign,
        utm_content: app.utm_content,
        status: app.status,
        created_at: app.created_at,
        updated_at: app.updated_at,
        reviewed_at: app.reviewed_at,
        funded_at: app.funded_at,
      }));

      res.json({
        success: true,
        applications: safeApplications,
        total: result.total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(result.total / options.limit),
      });
    } catch (error) {
      console.error("List applications error:", error);
      res.status(500).json({ error: "Failed to retrieve applications" });
    }
  },
);

// GET /api/admin/applications/:id — View single application
router.get(
  "/applications/:id",
  requireAuth(),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const includeDecrypted = req.query.decrypt === "true";

      let application;
      if (includeDecrypted) {
        if (!req.user || !["admin", "reviewer"].includes(req.user.role)) {
          res.status(403).json({
            error: "Insufficient permissions to view decrypted data",
          });
          return;
        }
        application = await getApplicationByIdDecrypted(id);
      } else {
        application = await getApplicationById(id);
      }

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      const auditLog = await getAuditLog(id);

      const response = {
        ...application,
        ssn_encrypted: "[ENCRYPTED]",
        dl_number_encrypted: "[ENCRYPTED]",
        account_number_encrypted: "[ENCRYPTED]",
      };

      if (includeDecrypted) {
        const decrypted = application as typeof application & {
          ssn_decrypted: string;
          dl_decrypted: string;
          account_decrypted: string;
        };
        Object.assign(response, {
          ssn_decrypted: decrypted.ssn_decrypted,
          dl_decrypted: decrypted.dl_decrypted,
          account_decrypted: decrypted.account_decrypted,
        });
      }

      res.json({
        success: true,
        application: response,
        auditLog,
      });
    } catch (error) {
      console.error("Get application error:", error);
      res.status(500).json({ error: "Failed to retrieve application" });
    }
  },
);

// PATCH /api/admin/applications/:id — Update status
router.patch(
  "/applications/:id",
  requireAuth(["admin", "reviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({ error: "Status is required" });
        return;
      }

      const updated = await updateApplicationStatus(
        id,
        status,
        req.user!.email,
      );

      if (!updated) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      res.json({
        success: true,
        message: `Application status updated to ${status}`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("Update application error:", errMsg);

      if (errMsg.startsWith("Invalid status")) {
        res.status(400).json({ error: errMsg });
        return;
      }

      res.status(500).json({ error: "Failed to update application" });
    }
  },
);

// DELETE /api/admin/applications/:id — Delete application (admin only)
router.delete(
  "/applications/:id",
  requireAuth(["admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const deleted = await deleteApplication(id);

      if (!deleted) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      res.json({
        success: true,
        message: "Application deleted",
      });
    } catch (error) {
      console.error("Delete application error:", error);
      res.status(500).json({ error: "Failed to delete application" });
    }
  },
);

// GET /api/admin/stats — Dashboard statistics
router.get("/stats", requireAuth(), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getApplicationStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to retrieve statistics" });
  }
});

export default router;
