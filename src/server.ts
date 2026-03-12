import "dotenv/config";

import express from "express";
import cors from "cors";

import applyRoutes from "./routes/apply";
import contactRoutes from "./routes/contact";
import geoCheckRoutes from "./routes/geoCheck";
import routingLookupRoutes from "./routes/routingLookup";
import adminRoutes from "./routes/admin";
import applicationStatusRoutes from "./routes/applicationStatus";

const app = express();
const PORT = process.env.PORT || 5000;

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

app.listen(PORT, () => {
  console.log(`Creek Lend Backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
