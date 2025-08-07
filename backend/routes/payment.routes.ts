import { Router } from "express";
import { body } from "express-validator";
import { PaymentController } from "../controllers/payment.controller";
import { authenticateApiKey, authenticateToken } from "../middleware/auth.middleware";
import { paymentRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../middleware/error.middleware";

const router = Router();
const paymentController = new PaymentController();

// CREATE PAYMENT (API key auth for merchant integrations)
router.post(
  "/",
  authenticateApiKey,
  paymentRateLimit,
  [
    body("amount").isFloat({ min: 0.01, max: 1000000 }),
    body("currency").optional().isIn(["USDC"]),
    body("externalId").optional().isLength({ max: 255 }),
    body("expiresIn").optional().isInt({ min: 5, max: 1440 }), // 5 minutes to 24 hours
    body("customerEmail").optional().isEmail(),
    body("description").optional().isLength({ max: 500 }),
  ],
  asyncHandler(paymentController.createPayment.bind(paymentController))
);

// GET PAYMENT BY ID
router.get(
  "/:id",
  asyncHandler(paymentController.getPayment.bind(paymentController))
);

// CANCEL PAYMENT
router.post(
  "/:id/cancel",
  authenticateApiKey,
  asyncHandler(paymentController.cancelPayment.bind(paymentController))
);

// LIST PAYMENTS (JWT auth for merchant dashboard)
router.get(
  "/",
  authenticateToken,
  asyncHandler(paymentController.listPayments.bind(paymentController))
);

export default router;