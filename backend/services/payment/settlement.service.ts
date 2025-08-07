import { dbPool } from "../../database/connection";
import { MerchantModel } from "../../models/merchant.model";
import { BlockchainService } from "./blockchain.service";
import { WebhookService } from "../notification/webhook.service";
import { logger } from "../../utils/logger";
import { CustomError } from "@/backend/middleware/error.middleware";

interface Settlement {
  id: string;
  merchantId: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  transactionCount: number;
  periodStart: Date;
  periodEnd: Date;
  status: "pending" | "processing" | "completed" | "failed";
  settlementHash?: string;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export class SettlementService {
  private blockchainService: BlockchainService;
  private webhookService: WebhookService;

  constructor() {
    this.blockchainService = new BlockchainService();
    this.webhookService = new WebhookService();
  }

  // PROCESS DAILY SETTLEMENTS FOR ALL MERCHANTS
  async processDailySettlements(): Promise<void> {
    try {
      logger.info("Processing daily settlements...");

      const client = await dbPool.connect();

      try {
        // GET ALL ACTIVE MERCHANTS WITH DAILY SETTLEMENT SCHEDULE
        const { rows: merchants } = await client.query(`
                    SELECT id, settlement_address, fee_rate, settlement_schedule
                    FROM merchants
                    WHERE status = 'active'
                    AND settlement_schedule = 'daily'
                    AND settlement_address IS NOT NULL  
                    `);

        for (const merchant of merchants) {
          await this.processMerchantSettlement(merchant.id, "daily");
        }

        logger.info(`Processed settlements for ${merchants.length} merchants`);
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error("Failed to process daily settlements", error);
    }
  }

  // PROCESS SETTLEMENT FOR A SPECIFIC MERCHANT
  async processMerchantSettlement(
    merchantId: string,
    period: "daily" | "weekly" | "monthly"
  ): Promise<Settlement | null> {
    const client = await dbPool.connect();

    try {
      await client.query("BEGIN");

      // GET MERCHANT DETAILS
      const merchant = await MerchantModel.findById(merchantId);
      if (!merchant || !merchant.settlementAddress) {
        throw new CustomError(
          "Merchant not found or no settlement address",
          404
        );
      }

      // CALCULATE SETTLEMENT PERIOD
      const { periodStart, periodEnd } = this.getSettlementPeriod(period);

      // GET COMPLETED PAYMENTS FOR THE PERIOD
      const { rows: payments } = await client.query(
        `
                SELECT p.id, p.amount
                FROM payments p
                LEFT JOIN settlement_payments sp ON p.id = sp.payment_id
                WHERE p.merchant_id = $1
                AND p.status = 'completed'
                AND p.completed_at >= $2
                AND p.completed_at < $3
                AND sp.settlement_id IS NULL

                `,
        [merchantId, periodStart, periodEnd]
      );

      if (payments.length === 0) {
        logger.info("No payments to settle for merchant:", {
          merchantId,
          period,
        });
        await client.query("ROLLBACK");
        return null;
      }

      // CALCULATE SETTLEMENT AMOUNTS
      const totalAmount = payments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      const feeAmount = totalAmount * merchant.feeRate;
      const netAmount = totalAmount - feeAmount;

      if (netAmount <= 0) {
        logger.warn("Net settlement amount is zero or negative:", {
          merchantId,
          netAmount,
        });
        await client.query("ROLLBACK");
        return null;
      }

      // CREATE SETTLEMENT RECORD
      const {
        rows: [settlement],
      } = await client.query(
        `
                    INSERT INTO settlements (
                    merchant_id, amount, fee_amount, net_amount, transaction_count,
                    period_start, period_end, status 
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                     RETURNING * 
                    `,
        [
          merchantId,
          totalAmount,
          feeAmount,
          netAmount,
          payments.length,
          periodStart,
          periodEnd,
        ]
      );

      // LINK PAYMENTS TO SETTLEMENT
      for (const payment of payments) {
        await client.query(
          "INSERT INTO settlement_payments (settlement_id, payment_id) VALUES ($1, $2)",
          [settlement.id, payment.id]
        );
      }

      await client.query("COMMIT");

      // PROCESS BLOCKCHAIN SETTLEMENT
      await this.executeSettlement(settlement.id);

      return this.mapRowToSettlement(settlement);
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Failed to process merchant settlement", {
        merchantId,
        error,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // EXECUTE SETTLEMENT ON BLOCKCHAIN
  async executeSettlement(settlementId: string): Promise<void> {
    const client = await dbPool.connect();

    try {
      // GET SETTLEMENT DETAILS
      const {
        rows: [settlement],
      } = await client.query("SELECT * FROM settlements WHERE id = $1", [
        settlementId,
      ]);

      if (!settlement) {
        throw new CustomError("Settlement not found", 404);
      }

      // GET MERCHANT SETTLEMENT ADDRESS
      const merchant = await MerchantModel.findById(settlement.merchant_id);
      if (!merchant?.settlementAddress) {
        throw new CustomError("Merchant has no settlement address", 404);
      }

      // UPDATE SETTLEMENT STATUS TO PROCESSING
      await client.query(
        "UPDATE settlements SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2",
        ["processing", settlementId]
      );

      // SEND USDC TO MERCHANT
      const settlementHash = await this.blockchainService.sendUSDC(
        merchant.settlementAddress,
        settlement.net_amount.toString(),
        "polygon" // Use Polygon for lower fees
      );

      // UPDATE SETTLEMENT WITH TRANSACTION HASH
      await client.query(
        "UPDATE settlements SET settlement_hash = $1 WHERE id = $2",
        [settlementHash, settlementId]
      );

      // MONITOR TRANSACTION
      this.blockchainService
        .monitorTransaction(settlementHash, "polygon")
        .then(() => this.completeSettlement(settlementId))
        .catch((error) => this.failSettlement(settlementId, error.message));

      logger.info("Settlement transaction sent:", {
        settlementId,
        merchantId: settlement.merchant_id,
        amount: settlement.net_amount,
        hash: settlementHash,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.failSettlement(settlementId, errorMessage);
      throw error;
    } finally {
      client.release();
    }
  }

  // COMPLETE A SETTLEMENT
  async completeSettlement(settlementId: string): Promise<void> {
    const client = await dbPool.connect();

    try {
      const {
        rows: [settlement],
      } = await client.query(
        `
            UPDATE settlements
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            `,
        [settlementId]
      );

      if (settlement) {
        await this.webhookService.sendSettlementWebhook(
          settlement.merchant_id,
          {
            event: "settlement.completed",
            settlement: this.mapRowToSettlement(settlement),
          }
        );

        logger.info("Settlement completed:", { settlementId });
      }
    } catch (error) {
      logger.error("Failed to complete settlement", { settlementId, error });
    } finally {
      client.release();
    }
  }

  // MARK SETTLEMENT AS FAILED
  async failSettlement(
    settlementId: string,
    errorMessage: string
  ): Promise<void> {
    const client = await dbPool.connect();

    try {
      await client.query(
        `
            UPDATE settlements
            SET status = 'failed', completed_at = CURRENT_TIMESTAMP, error_message = $1
            WHERE id = $2 
            `,
        [errorMessage, settlementId]
      );

      logger.error("Settlement failed:", { settlementId, errorMessage });
    } catch (error) {
      logger.error("Failed to update settlement status:", {
        settlementId,
        error,
      });
    } finally {
      client.release();
    }
  }

  // GET SETTLEMENT PERIOD DATES
  private getSettlementPeriod(period: "daily" | "weekly" | "monthly"): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "daily":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          periodStart: yesterday,
          periodEnd: today,
        };

      case "weekly":
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        return {
          periodStart: weekStart,
          periodEnd: today,
        };

      case "monthly":
        const monthStart = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1
        );
        const monthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          periodStart: monthStart,
          periodEnd: monthEnd,
        };

      default:
        throw new CustomError("Invalid settlement period", 400);
    }
  }

  // MAP DATABASE ROW TO SETTLEMENT OBJECT
  private mapRowToSettlement(row: any): Settlement {
    return {
      id: row.id,
      merchantId: row.merchant_id,
      amount: parseFloat(row.amount),
      feeAmount: parseFloat(row.fee_amount),
      netAmount: parseFloat(row.net_amount),
      transactionCount: row.transaction_count,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      settlementHash: row.settlement_hash,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
    };
  }
}
