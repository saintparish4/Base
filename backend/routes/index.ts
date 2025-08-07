import { Router } from "express";
import authRoutes from "./auth.routes";
// import merchantRoutes from "./merchant.routes";
import paymentRoutes from "./payment.routes";
//import transactionRoutes from "./transaction.routes";
import webhookRoutes from "./webhook.routes";
//import adminRoutes from "./admin.routes";

const router = Router();

// HEALTH CHECK ENDPOINT
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// API ROUTES
router.use("/auth", authRoutes);
//router.use('/merchants', merchantRoutes);
router.use("/payments", paymentRoutes);
//router.use('/transactions', transactionRoutes);
router.use("/webhooks", webhookRoutes);
//router.use('/admin', adminRoutes);

export default router;
