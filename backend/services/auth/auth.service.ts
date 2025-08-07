import * as jwt from "jsonwebtoken";
import { config } from "../../config/environment";
import { redisClient } from "../../config/redis";
import { generateSecureToken } from "../../utils/crypto";
import { MerchantModel } from "../../models/merchant.model";
import { logger } from "../../utils/logger";

export class AuthService {
  // TODO: For production, replace (jwt as any) with proper typed solution
  // Options: 1) Create typed wrapper module, 2) Switch to 'jose' library, 3) Wait for jsonwebtoken fix
  generateTokens(payload: any): { accessToken: string; refreshToken: string } {
    const accessToken = (jwt as any).sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = (jwt as any).sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  generatePasswordResetToken(merchantId: string): string {
    const token = generateSecureToken(32);

    // STORE TOKEN IN REDIS WITH 1 HOUR EXPIRATION
    redisClient
      .setEx(`reset:${token}`, 3600, merchantId)
      .catch((error) => logger.error("Failed to store reset token:", error));

    return token;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const merchantId = await redisClient.get(`reset:${token}`);

      if (!merchantId) {
        return false;
      }

      // UPDATE PASSWORD
      await MerchantModel.updatePassword(merchantId, newPassword);

      // DELETE RESET TOKEN
      await redisClient.del(`reset:${token}`);

      return true;
    } catch (error) {
      logger.error("Password reset failed:", error);
      return false;
    }
  }
}
