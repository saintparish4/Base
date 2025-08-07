import axios from "axios";
import { dbPool } from "../../database/connection";
import { MerchantModel } from "../../models/merchant.model";
import { createHmacSignature } from "../../utils/crypto";
import { logger } from "../../utils/logger";

export class WebhookService {
  async sendPaymentWebhook(merchantId: string, payload: any): Promise<void> {
    try {
      const merchant = await MerchantModel.findById(merchantId);

      if (!merchant?.webhookUrl) {
        return; // NO WEBHOOK URL CONFIGURED
      }

      const webhookPayload = {
        ...payload,
        timestamp: new Date().toISOString(),
        merchantId,
      };

      const signature = createHmacSignature(
        JSON.stringify(webhookPayload),
        merchant.webhookSecret || "default-secret"
      );

      // STORE WEBHOOK EVENT
      await this.storeWebhookEvent(
        merchantId,
        payload.event,
        payload,
        "pending"
      );

      // SEND WEBHOOK
      const response = await axios.post(merchant.webhookUrl, webhookPayload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "User-Agent": "BASE-Webhook/1.0",
        },
        timeout: 10000, // 10 seconds timeout
      });

      if (response.status >= 200 && response.status < 300) {
        await this.updateWebhookStatus(merchantId, payload.event, "delivered");
        logger.info("Webhook sent successfully:", {
          merchantId,
          event: payload.event,
          url: merchant.webhookUrl,
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error("Webhook delivery failed:", {
        merchantId,
        event: payload.event,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.updateWebhookStatus(merchantId, payload.event, "failed");
      // TODO: IMPLEMENT RETRY LOGIC
    }
  }

  async sendSettlementWebhook(merchantId: string, payload: any): Promise<void> {
    await this.sendPaymentWebhook(merchantId, payload);
  }

  private async storeWebhookEvent(
    merchantId: string,
    eventType: string,
    payload: any,
    status: string
  ): Promise<void> {
    const client = await dbPool.connect();

    try {
      await client.query(
        `
                    INSERT INTO webhook_events (merchant_id, event_type, resource_id, payload, status)
                    VALUES ($1, $2, $3, $4, $5) 
                `,
        [
          merchantId,
          eventType,
          payload.payment?.id || payload.settlement?.id,
          JSON.stringify(payload),
          status,
        ]
      );
    } finally {
      client.release();
    }
  }

  private async updateWebhookStatus(
    merchantId: string,
    eventType: string,
    status: string
  ): Promise<void> {
    const client = await dbPool.connect();

    try {
      await client.query(
        `
                    UPDATE webhook_events
                    SET status = $1, delivered_at = CURRENT_TIMESTAMP
                    WHERE merchant_id = $2 AND event_type = $3 AND status = 'pending'
                `,
        [status, merchantId, eventType]
      );
    } finally {
      client.release();
    }
  }
}
