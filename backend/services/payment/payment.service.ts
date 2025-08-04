import { ethers } from "ethers";
import QRCode from "qrcode";
import { PaymentModel, TransactionModel } from "../../models/payment.model";
import { MerchantModel } from "../../models/merchant.model";
import { BlockchainService } from "./blockchain.service";
import { WebhookService } from "../notification/webhook.service";
import {
  Payment,
  CreatePaymentRequest,
  Transaction,
} from "../../types/payment.types";
import { logger } from "../../utils/logger";
import { CustomError } from "../../middleware/error.middleware";

export class PaymentService {
  private blockchainService: BlockchainService;
  private webhookService: WebhookService;

  constructor() {
    this.blockchainService = new BlockchainService();
    this.webhookService = new WebhookService();
  }

  // CREATE A NEW PAYMENT REQUEST
  async createPayment(
    merchantId: string,
    data: CreatePaymentRequest
  ): Promise<Payment> {
    try {
      // VALIDATE MERCHANT EXISTS AND IS ACTIVE
      const merchant = await MerchantModel.findById(merchantId);
      if (!merchant) {
        throw new CustomError("Merchant not found", 404);
      }

      if (merchant.status !== "active") {
        throw new CustomError("Merchant is not active", 403);
      }

      // VALIDATE PAYMENT AMOUNT
      if (data.amount <= 0 || data.amount > 1000000) {
        throw new CustomError("Invalid payment amount", 400);
      }

      // CREATE PAYMENT RECORD
      const payment = await PaymentModel.create(merchantId, data);

      // GENERATE PAYMENT ADDRESS AND QR CODE
      const paymentAddress =
        await this.blockchainService.generatePaymentAddress(payment.id);
      const qrCodeData = await this.generatePaymentQR(payment, paymentAddress);

      await PaymentModel.setQRCode(payment.id, qrCodeData);

      logger.info("Payment created:", {
        paymentId: payment.id,
        merchantId,
        amount: payment.amount,
        currency: payment.currency,
      });

      return { ...payment, qrCodeData };
    } catch (error) {
      logger.error("Error creating payment:", error);
      throw error;
    }
  }

  // PROCESS INCOMING BLOCKCHAIN TRANSACTIONS
  async processTransaction(
    transactionHash: string,
    network: "ethereum" | "polygon"
  ): Promise<void> {
    try {
      // CHECK IF TRANSACTION ALREADY PROCESSED
      const existingTx = await TransactionModel.findByHash(transactionHash);
      if (existingTx) {
        logger.warn("Transaction already processed:", { transactionHash });
        return;
      }

      // Get transaction details from blockchain
      const txDetails = await this.blockchainService.getTransactionDetails(
        transactionHash,
        network
      );
      if (!txDetails) {
        throw new CustomError("Transaction not found on blockchain", 404);
      }

      // Find matching payment
      const payment = await this.findPaymentByTransaction(txDetails);
      if (!payment) {
        logger.warn("No matching payment found for transaction:", {
          transactionHash,
        });
        return;
      }

      // Validate transaction amount and recipient
      const expectedAmount = ethers.parseUnits(payment.amount.toString(), 6); // USDC has 6 decimals
      if (txDetails.amount < expectedAmount) {
        logger.warn("Transaction amount insufficient:", {
          paymentId: payment.id,
          expected: expectedAmount.toString(),
          received: txDetails.amount.toString(),
        });
        return;
      }

      // Create transaction record
      const transaction = await TransactionModel.create({
        paymentId: payment.id,
        transactionHash: txDetails.hash,
        network,
        fromAddress: txDetails.from,
        toAddress: txDetails.to,
        amount: parseFloat(ethers.formatUnits(txDetails.amount, 6)),
        gasUsed: txDetails.gasUsed,
        gasPrice: txDetails.gasPrice?.toString(),
        blockNumber: txDetails.blockNumber,
        blockHash: txDetails.blockHash,
        confirmationCount: txDetails.confirmations,
        status:
          txDetails.confirmations >= this.getRequiredConfirmations(network)
            ? "confirmed"
            : "pending",
      });

      // Update payment status if confirmed
      if (transaction.status === "confirmed") {
        await this.completePayment(payment.id);
      }

      logger.info("Transaction processed:", {
        transactionHash,
        paymentId: payment.id,
        status: transaction.status,
      });
    } catch (error) {
      logger.error("Failed to process transaction:", {
        transactionHash,
        error,
      });
      throw error;
    }
  }

  /**
   * Complete a payment
   */
  async completePayment(paymentId: string): Promise<void> {
    try {
      const payment = await PaymentModel.findById(paymentId);
      if (!payment) {
        throw new CustomError("Payment not found", 404);
      }

      if (payment.status === "completed") {
        return; // Already completed
      }

      // Update payment status
      await PaymentModel.updateStatus(paymentId, "completed");

      // Send webhook notification
      await this.webhookService.sendPaymentWebhook(payment.merchantId, {
        event: "payment.completed",
        payment: { ...payment, status: "completed" },
      });

      logger.info("Payment completed:", { paymentId });
    } catch (error) {
      logger.error("Failed to complete payment:", { paymentId, error });
      throw error;
    }
  }

  /**
   * Cancel expired payments
   */
  async cancelExpiredPayments(): Promise<void> {
    try {
      const expiredPayments = await PaymentModel.getExpiredPayments();

      for (const payment of expiredPayments) {
        await PaymentModel.updateStatus(payment.id, "expired");

        await this.webhookService.sendPaymentWebhook(payment.merchantId, {
          event: "payment.expired",
          payment: { ...payment, status: "expired" },
        });
      }

      if (expiredPayments.length > 0) {
        logger.info(`Cancelled ${expiredPayments.length} expired payments`);
      }
    } catch (error) {
      logger.error("Failed to cancel expired payments:", error);
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<Payment | null> {
    return await PaymentModel.findById(paymentId);
  }

  /**
   * Generate QR code for payment
   */
  private async generatePaymentQR(
    payment: Payment,
    address: string
  ): Promise<string> {
    const qrData = {
      address,
      amount: payment.amount,
      currency: payment.currency,
      paymentId: payment.id,
    };

    return await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  }

  /**
   * Find payment by transaction details
   */
  private async findPaymentByTransaction(
    txDetails: any
  ): Promise<Payment | null> {
    // Implementation would depend on how you track payment addresses
    // For now, this is a placeholder that would need proper address mapping
    return null;
  }

  /**
   * Get required confirmations for network
   */
  private getRequiredConfirmations(network: "ethereum" | "polygon"): number {
    return network === "ethereum" ? 3 : 10; // Polygon needs more due to faster blocks
  }
}
