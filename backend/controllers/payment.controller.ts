import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { PaymentService } from "../services/payment/payment.service";
import { FeeService } from "../services/payment/fee.service";
import { MerchantModel } from "../models/merchant.model";
import { PaymentModel } from "../models/payment.model";
import { logger } from "../utils/logger";
import { CustomError } from "../middleware/error.middleware";
import {
  ApiResponse,
  PaginationParams,
  FilterParams,
} from "../types/api.types";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  async createPayment(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }

    try {
      // GET MERCHANT FROM API KEY ( SET BY AUTHENTICATEAPIKEY MIDDLEWARE)
      const apiKey = req.headers["x-api-key"] as string;
      const merchant = await MerchantModel.findByApiKey(apiKey);

      if (!merchant) {
        return res.status(401).json({
          success: false,
          error: "Invalid API key",
        });
      }

      // CREATE PAYMENT
      const payment = await this.paymentService.createPayment(
        merchant.id,
        req.body
      );

      // CALCULATE FEE INFORMATION
      const feeInfo = FeeService.calculatePaymentFee(
        payment.amount,
        merchant.feeRate
      );

      logger.info("Payment created via API:", {
        paymentId: payment.id,
        merchantId: merchant.id,
        amount: payment.amount,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            paymentUrl: payment.paymentUrl,
            qrCodeData: payment.qrCodeData,
            expiresAt: payment.expiresAt,
            createdAt: payment.createdAt,
          },
          feeInfo,
        },
        message: "Payment created successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error("Payment creation failed:", error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  async getPayment(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const payment = await PaymentModel.findById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      const response: ApiResponse = {
        success: true,
        data: {
          payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            expiresAt: payment.expiresAt,
            createdAt: payment.createdAt,
          },
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Failed to get payment:", { paymentId: id, error });
      throw new CustomError("Failed to retrieve payment", 500);
    }
  }

  async listPayments(req: AuthenticatedRequest, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }

    try {
      if (!req.user?.merchantId) {
        return res.status(401).json({
          success: false,
          error: "Merchant authentication required",
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const payments = await PaymentModel.findByMerchant(
        req.user.merchantId,
        limit,
        offset
      );

      // GET TOTAL COUNT FOR PAGINATION
      // TODO: IMPLEMENT COUNT QUERY IN PAYMENTMODEL
      const totalCount = payments.length; // SIMPLIFIED FOR MVP

      const response: ApiResponse = {
        success: true,
        data: {
          payments: payments.map((payment) => ({
            id: payment.id,
            externalId: payment.externalId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            customerEmail: payment.customerEmail,
            createdAt: payment.createdAt,
            completedAt: payment.completedAt,
          })),
        },
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };

      res.json(response);
    } catch (error) {
      logger.error("Failed to list payments:", error);
      throw new CustomError("Failed to retrieve payments", 500);
    }
  }

  async cancelPayment(req: Request, res: Response) {
    const { id } = req.params;

    try {
      // GET MERCHANT FROM API KEY
      const apiKey = req.headers["x-api-key"] as string;
      const merchant = await MerchantModel.findByApiKey(apiKey);

      if (!merchant) {
        return res.status(401).json({
          success: false,
          error: "Invalid API key",
        });
      }

      const payment = await PaymentModel.findById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      // VERIFY PAYMENT BELONGS TO MERCHANT
      if (payment.merchantId !== merchant.id) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      // CHECK IF PAYMENT CAN BE CANCELLED
      if (!["pending", "processing"].includes(payment.status)) {
        return res.status(400).json({
          success: false,
          error: "Payment cannot be cancelled",
        });
      }

      // CANCEL PAYMENT
      await PaymentModel.updateStatus(id, "cancelled");

      logger.info("Payment cancelled:", {
        paymentId: id,
        merchantId: merchant.id,
      });

      const response: ApiResponse = {
        success: true,
        message: "Payment cancelled successfully",
      };

      res.json(response);
    } catch (error) {
      logger.error("Payment cancellation failed:", { paymentId: id, error });
      throw new CustomError("Failed to cancel payment", 500);
    }
  }

  async refundPayment(req: Request, res: Response) {
    // TODO: IMPLEMENT REFUND FUNCTIONALITY
    res.status(501).json({
      success: false,
      error: "Refund functionality not yet implemented",
    });
  }
}
