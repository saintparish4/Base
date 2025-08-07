import { dbPool } from "../database/connection";
import {
  Payment,
  CreatePaymentRequest,
  Transaction,
} from "../types/payment.types";
import { v4 as uuidv4 } from "uuid";

export class PaymentModel {
  static async create(
    merchantId: string,
    data: CreatePaymentRequest
  ): Promise<Payment> {
    const client = await dbPool.connect();

    try {
      const paymentId = uuidv4();
      const expiresAt = data.expiresIn
        ? new Date(Date.now() + data.expiresIn * 60 * 1000)
        : new Date(Date.now() + 30 * 60 * 1000); // 30 minutes default

      const paymentUrl = `${process.env.PAYMENT_BASE_URL}/pay/${paymentId}`;

      const query = `
                INSERT INTO payments (
                id, merchant_id, external_id, amount, currency, payment_url, expires_at, customer_email, customer_phone, description, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING * 
            `;

      const values = [
        paymentId,
        merchantId,
        data.externalId,
        data.amount,
        data.currency || "USDC",
        paymentUrl,
        expiresAt,
        data.customerEmail,
        data.customerPhone,
        data.description,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ];

      const { rows } = await client.query(query, values);
      return this.mapRowToPayment(rows[0]);
    } finally {
      client.release();
    }
  }

  static async findById(id: string): Promise<Payment | null> {
    const client = await dbPool.connect();

    try {
      const { rows } = await client.query(
        "SELECT * FROM payments WHERE id = $1",
        [id]
      );

      return rows.length > 0 ? this.mapRowToPayment(rows[0]) : null;
    } finally {
      client.release();
    }
  }

  static async findByMerchant(
    merchantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Payment[]> {
    const client = await dbPool.connect();

    try {
      const { rows } = await client.query(
        `SELECT * FROM payments
                WHERE merchant_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3`,
        [merchantId, limit, offset]
      );

      return rows.map(this.mapRowToPayment);
    } finally {
      client.release();
    }
  }

  static async countByMerchant(merchantId: string): Promise<number> {
    const client = await dbPool.connect();

    try {
      const { rows } = await client.query(
        `SELECT COUNT(*) as count FROM payments WHERE merchant_id = $1`,
        [merchantId]
      );

      return parseInt(rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  static async updateStatus(
    id: string,
    status: Payment["status"]
  ): Promise<boolean> {
    const client = await dbPool.connect();

    try {
      const updates = ["status = $1"];
      const values = [status, id];

      if (status === "completed") {
        updates.push("completed_at = CURRENT_TIMESTAMP");
      } else if (status === "cancelled") {
        updates.push("cancelled_at = CURRENT_TIMESTAMP");
      }

      const query = `
                UPDATE payments
                SET ${updates.join(", ")}
                WHERE id = $2 
           `;

      const { rowCount } = await client.query(query, values);
      return (rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  static async setQRCode(id: string, qrCodeData: string): Promise<boolean> {
    const client = await dbPool.connect();

    try {
      const { rowCount } = await client.query(
        "UPDATE payments SET qr_code_data = $1 WHERE id = $2",
        [qrCodeData, id]
      );

      return (rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  static async getExpiredPayments(): Promise<Payment[]> {
    const client = await dbPool.connect();

    try {
      const { rows } = await client.query(
        `SELECT * FROM payments 
                WHERE status = 'pending'
                AND expires_at < CURRENT_TIMESTAMP`,
        []
      );

      return rows.map(this.mapRowToPayment);
    } finally {
      client.release();
    }
  }

  static async markExpiredPayments(): Promise<number> {
    const client = await dbPool.connect();

    try {
      const { rowCount } = await client.query(
        `UPDATE payments 
         SET status = 'expired'
         WHERE status = 'pending'
         AND expires_at < CURRENT_TIMESTAMP`,
        []
      );

      return rowCount ?? 0;
    } finally {
      client.release();
    }
  }

  private static mapRowToPayment(row: any): Payment {
    return {
      id: row.id,
      merchantId: row.merchant_id,
      externalId: row.external_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      paymentUrl: row.payment_url,
      qrCodeData: row.qr_code_data,
      expiresAt: row.expires_at,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
    };
  }
}

export class TransactionModel {
  static async create(
    data: Omit<Transaction, "id" | "createdAt">
  ): Promise<Transaction> {
    const client = await dbPool.connect();

    try {
      const query = `
                INSERT INTO transactions (
                payment_id, transaction_hash, network, from_address, to_address, amount, gas_used, gas_price, block_number, block_hash, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *  
            `;

      const values = [
        data.paymentId,
        data.transactionHash,
        data.network,
        data.fromAddress,
        data.toAddress,
        data.amount,
        data.gasUsed,
        data.gasPrice,
        data.blockNumber,
        data.blockHash,
        data.status,
      ];

      const { rows } = await client.query(query, values);
      return this.mapRowToTransaction(rows[0]);
    } finally {
      client.release();
    }
  }

  static async findByHash(hash: string): Promise<Transaction | null> {
    const client = await dbPool.connect();

    try {
      const { rows } = await client.query(
        "SELECT * FROM transactions WHERE transaction_hash = $1",
        [hash]
      );

      return rows.length > 0 ? this.mapRowToTransaction(rows[0]) : null;
    } finally {
      client.release();
    }
  }

  static async updateConfirmations(
    hash: string,
    confirmations: number
  ): Promise<boolean> {
    const client = await dbPool.connect();

    try {
      const { rowCount } = await client.query(
        "UPDATE transactions SET confirmations = $1 WHERE transaction_hash = $2",
        [confirmations, hash]
      );

      return (rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  private static mapRowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      paymentId: row.payment_id,
      transactionHash: row.transaction_hash,
      network: row.network,
      fromAddress: row.from_address,
      toAddress: row.to_address,
      amount: parseFloat(row.amount),
      gasUsed: row.gas_used,
      gasPrice: row.gas_price,
      blockNumber: row.block_number,
      blockHash: row.block_hash,
      confirmationCount: row.confirmation_count,
      status: row.status,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      failedAt: row.failed_at,
      errorMessage: row.error_message,
    };
  }
}
