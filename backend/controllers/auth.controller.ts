import { Request, Response } from "express";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { MerchantModel } from "../models/merchant.model";
import { AuthService } from "../services/auth/auth.service";
import { EmailService } from "../services/notification/email.service";
import { config } from "../config/environment";
import { logger } from "../utils/logger";
import { CustomError } from "../middleware/error.middleware";
import { ApiResponse } from "../types/api.types";

export class AuthController {
  private authService: AuthService;
  private emailService: EmailService;

  constructor() {
    this.authService = new AuthService();
    this.emailService = new EmailService();
  }

  async register(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const {
      email,
      password,
      businessName,
      businessType,
      contactPhone,
      businessAddress,
    } = req.body;

    try {
      // CHECK IF MERCHANT ALREADY EXISTS
      const existingMerchant = await MerchantModel.findByEmail(email);
      if (existingMerchant) {
        return res.status(409).json({
          success: false,
          error: "Merchant already exists with this email",
        });
      }

      // CREATE MERCHANT
      const merchant = await MerchantModel.create({
        email,
        password,
        businessName,
        businessType,
        contactPhone,
        businessAddress,
      });

      // GENERATE TOKENS
      const { accessToken, refreshToken } = this.authService.generateTokens({
        id: merchant.id,
        email: merchant.email,
        role: "merchant",
        merchantId: merchant.id,
      });

      // SEND WELCOME EMAIL (ASYNC)
      this.emailService
        .sendWelcomeEmail(merchant.email, merchant.businessName)
        .catch((error) => logger.error("Failed to send welcome email:", error));

      logger.info("Merchant registered:", {
        merchantId: merchant.id,
        email: merchant.email,
        businessName: merchant.businessName,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          merchant: {
            id: merchant.id,
            email: merchant.email,
            businessName: merchant.businessName,
            status: merchant.status,
            kycStatus: merchant.kycStatus,
          },
          accessToken,
          refreshToken,
        },
        message: "Merchant registered successfully",
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error("Registration failed:", error);
      throw new CustomError("Registration failed", 500);
    }
  }

  async login(req: Request, res: Response) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const { email, password } = req.body;

    try {
      // VERIFY CREDENTIALS
      const merchant = await MerchantModel.verifyPassword(email, password);
      if (!merchant) {
        return res.status(401).json({
          success: false,
          error: "Invalid email or password",
        });
      }

      // CHECK IF MERCHANT IS ACTIVE
      if (merchant.status === "suspended") {
        return res.status(403).json({
          success: false,
          error: "Account is suspended. Please contact support.",
        });
      }

      // GENERATE TOKENS
      const { accessToken, refreshToken } = this.authService.generateTokens({
        id: merchant.id,
        email: merchant.email,
        role: "merchant",
        merchantId: merchant.id,
      });

      logger.info("Merchant logged in:", {
        merchantId: merchant.id,
        email: merchant.email,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          merchant: {
            id: merchant.id,
            email: merchant.email,
            businessName: merchant.businessName,
            status: merchant.status,
            kycStatus: merchant.kycStatus,
          },
          accessToken,
          refreshToken,
        },
        message: "Login successful",
      };

      res.json(response);
    } catch (error) {
      logger.error("Login failed:", error);
      throw new CustomError("Login Failed", 500);
    }
  }

  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: "Refresh token required",
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;

      // VERIFY MERCHANT STILL EXISTS AND IS ACTIVE
      const merchant = await MerchantModel.findById(decoded.id);
      if (!merchant || merchant.status === "suspended") {
        return res.status(401).json({
          success: false,
          error: "Invalid refresh token",
        });
      }

      // GENERATE NEW TOKENS
      const tokens = this.authService.generateTokens({
        id: merchant.id,
        email: merchant.email,
        role: "merchant",
        merchantId: merchant.id,
      });

      const response: ApiResponse = {
        success: true,
        data: tokens,
        message: "Token refreshed successfully",
      };

      res.json(response);
    } catch (error) {
      logger.error("Token refresh failed:", error);
      return res.status(401).json({
        success: false,
        error: "Invalid refresh token",
      });
    }
  }

  async logout(req: Request, res: Response) {
    // IN PRODUCTION WOULD BLACKLIST THE TOKEN
    // FOR MVP, JUST RETURN SUCCESS
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  }

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    try {
      const merchant = await MerchantModel.findByEmail(email);
      if (!merchant) {
        // DONT REVEAL IF EMAIL EXISTS OR NOT FOR SECURITY
        return res.json({
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent",
        });
      }

      // GENERATE RESET TOKEN
      const resetToken = this.authService.generatePasswordResetToken(
        merchant.id
      );

      // SEND RESET EMAIL (ASYNC)
      this.emailService
        .sendPasswordResetEmail(email, resetToken)
        .catch((error) =>
          logger.error("Failed to send password reset email:", error)
        );

      res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent",
      });
    } catch (error) {
      logger.error("Password reset request failed:", error);
      throw new CustomError("Password reset request failed", 500);
    }
  }

  async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;

    try {
      const isValid = await this.authService.resetPassword(token, newPassword);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired reset token",
        });
      }

      res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      logger.error("Password reset failed:", error);
      throw new CustomError("Password reset failed", 500);
    }
  }
}
