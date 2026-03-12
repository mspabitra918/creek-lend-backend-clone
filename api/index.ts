import "dotenv/config";

import express from "express";
import cors from "cors";

import applyRoutes from "../src/routes/apply";
import contactRoutes from "../src/routes/contact";
import geoCheckRoutes from "../src/routes/geoCheck";
import routingLookupRoutes from "../src/routes/routingLookup";
import adminRoutes from "../src/routes/admin";
import applicationStatusRoutes from "../src/routes/applicationStatus";

const app = express();

// CORS — allow frontend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/apply", applyRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/geo-check", geoCheckRoutes);
app.use("/api/routing-lookup", routingLookupRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/application-status", applicationStatusRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

export default app;
