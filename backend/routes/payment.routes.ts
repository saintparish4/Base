import { Router } from "express";
import { body, param, query } from "express-validator";
import { PaymentController } from "../controllers/payment.controller";
import { authenticateToken, authenticateApiKey } from "../middleware/auth.middleware";
import { paymentRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { auditLogger } from "../middleware/logging.middleware";

const router = Router();
const PaymentController = new PaymentController();

// CREATE PAYMENT (API key auth for merchant integrations)
router.post('/',
    authenticateApiKey,
    paymentRateLimit,
    [
        body('amount').isFloat({ min: 0.01, max: 1000000 }),
        body('currency').optional().isIn(['USDC']),
        body('externalId').optional().isLength({ max: 255 }),
        body('expiresIn').optional.isInt({ min: 5, max: 1440 }), // 5 minutes to 24 hours
        body('customerEmail').optional().isEmail(),
        body('description').optional().isLength({ max: 500 }), 
    ],
    auditLogger('create', "payment"),
    asyncHandler(PaymentController.createPayment.bind(PaymentController))
);