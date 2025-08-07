import { logger } from "../../utils/logger";

export class EmailService {
  async sendWelcomeEmail(email: string, businessName: string): Promise<void> {
    try {
      // TODO: IMPLEMENT ACTUAL EMAIL SENDING (SENDGRID, AWS SES, etc.)
      logger.info("Welcome email would be sent:", { email, businessName });
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    try {
      // TODO: IMPLEMENT ACTUAL EMAIL SENDING
      logger.info("Password reset email would be sent:", { email });
    } catch (error) {
      logger.error("Failed to send password reset email:", error);
    }
  }
}
