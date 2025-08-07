import { Request, Response } from "express";
import { PaymentService } from "../services/payment/payment.service";
import { logger } from "../utils/logger";
import { verifyHmacSignature } from "../utils/crypto";
import { config } from "../config/environment";

export class WebhookController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  async handleBlockchainTransaction(req: Request, res: Response) {
    try {
      // VERIFY WEBHOOK SIGNATURE
      const signature = req.headers["x-signature"] as string;
      const body = JSON.stringify(req.body);

      if (
        !signature ||
        !verifyHmacSignature(body, signature, config.webhookSecret)
      ) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const { transactionHash, network, status } = req.body;

      if (!transactionHash || !network) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // PROCESS THE TRANSACTION
      await this.paymentService.processTransaction(transactionHash, network);

      logger.info("Blockchain transaction webhook processed:", {
        transactionHash,
        network,
        status,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error("Webhook processing failed:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }

  async handlePaymentStatus(req: Request, res: Response) {
    try {
      const { paymentId, status } = req.body;

      if (!paymentId || !status) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      logger.info("Payment status webhook received:", { paymentId, status });

      res.json({ success: true });
    } catch (error) {
      logger.error("Payment status webhook failed", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
}
