import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller";
import { webhookRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();
const webhookController = new WebhookController();

// APPLY RATE LIMITING
router.use(webhookRateLimit);

// BLOCKCHAIN TRANSACTION WEBHOOK (FROM MONITORING SERVICE)
router.post(
  "/blockchain/transaction",
  asyncHandler(
    webhookController.handleBlockchainTransaction.bind(webhookController)
  )
);

// PAYMENT STATUS UPDATE WEBHOOK (INTERNAL)
router.post(
  "/payment/status",
  asyncHandler(webhookController.handlePaymentStatus.bind(webhookController))
);

export default router;
