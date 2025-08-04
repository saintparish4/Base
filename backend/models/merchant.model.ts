import { dbPool } from "../database/connection";
import { Merchant, CreateMerchantRequest, UpdateMerchantRequest } from "../types/merchant.types";
import { hashPassword, verifyPassword, generateSecureToken } from "../utils/crypto";
import { logger } from "../utils/logger";

export class MerchantModel {
    static async create(data: CreateMerchantRequest): Promise<Merchant> {
        const client = await dbPool.connect();

        try {
            const { hash, salt } = hashPassword(data.password);
            const apiKey = `cp_${generateSecureToken(32)}`;

            const query = `
            INSERT INTO merchants (
            email, password_hash, password_salt, business_name,
            business_type, contact_phone, business_address, api_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            `;

            const values = [
                data.email,
                hash,
                salt,
                data.businessName,
                data.businessType,
                data.contactPhone,
                data.businessAddress ? JSON.stringify(data.businessAddress) : null,
                apiKey,
            ];

            const { rows } = await client.query(query, values);
            return this.mapRowToMerchant(rows[0]); 
        } finally {
            client.release();
        }
    }

    static async findByEmail(email: string): Promise<Merchant | null> {
        const client = await dbPool.connect();

        try {
            const { rows } = await client.query(
                'SELECT * FROM merchants WHERE email = $1',
                [email] 
            );

            return rows.length > 0 ? this.mapRowToMerchant(rows[0]) : null; 
        } finally {
            client.release(); 
        }
    }

    static async findById(id: string): Promise<Merchant | null> {
        const client = await dbPool.connect();

        try {
            const { rows } = await client.query(
                'SELECT * FROM merchants WHERE id = $1',
                [id] 
            );

            return rows.length > 0 ? this.mapRowToMerchant(rows[0]) : null; 
        } finally {
            client.release();  
        }
    }

    static async findByApiKey(apiKey: string): Promise<Merchant | null> {
        const client = await dbPool.connect();

        try {
            const { rows } = await client.query(
                'SELECT * FROM merchants WHERE api_key = $1',
                [apiKey] 
            );

            return rows.length > 0 ? this.mapRowToMerchant(rows[0]) : null; 
        } finally {
            client.release(); 
        }
    }

    static async update(id: string, data: UpdateMerchantRequest): Promise<Merchant | null> {
        const client = await dbPool.connect();

        try {
            const updates: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined) {
                    if (key === 'businessAddress') {
                        updates.push(`business_address = $${paramIndex}`);
                        values.push(JSON.stringify(value)); 
                    } else {
                        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                        updates.push(`${dbKey} = $${paramIndex}`);
                        values.push(value); 
                    }
                    paramIndex++; 
                }
            });
            
            if (updates.length === 0) {
                return await this.findById(id); 
            }

            values.push(id);
            const query = `
                UPDATE merchants
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING * 
            `;

            const { rows } = await client.query(query, values);
            return rows.length > 0 ? this.mapRowToMerchant(rows[0]) : null;
        } finally {
            client.release();  
        }
    }

    static async verifyPassword(email: string, password: string): Promise<Merchant | null> {
        const client = await dbPool.connect();

        try {
            const { rows } = await client.query(
                'SELECT * FROM merchants WHERE email = $1',
                [email]
            );

            if (rows.length === 0) {
                return null; 
            }

            const merchant = rows[0];
            const isValid = verifyPassword(password, merchant.password_hash, merchant.password_salt);

            if (isValid) {
                // UPDATE LAST LOGIN
                await client.query(
                    'UPDATE merchants SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [merchant.id] 
                );

                return this.mapRowToMerchant(merchant); 
            }

            return null; 
        } finally {
            client.release(); 
        }
    }

    static async updateStatus(id: string, status: Merchant['status']): Promise<boolean> {
        const client = await dbPool.connect();

        try {
            const { rowCount } = await client.query(
                'UPDATE merchants SET status = $1 WHERE id = $2',
                [status, id] 
            );

            return (rowCount ?? 0) > 0; 
        } finally {
            client.release(); 
        }
    }

    private static mapRowToMerchant(row: any): Merchant {
        return {
            id: row.id,
            email: row.email,
            businessName: row.business_name,
            businessType: row.business_type,
            businessAddress: row.business_address ? JSON.parse(row.business_address) : undefined,
            contactPhone: row.contact_phone,
            status: row.status,
            kycStatus: row.kyc_status,
            kycData: row.kyc_data,
            apiKey: row.api_key,
            webhookUrl: row.webhook_url,
            webhookSecret: row.webhook_secret,
            settlementAddress: row.settlement_address,
            settlementSchedule: row.settlement_schedule,
            feeRate: parseFloat(row.fee_rate),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            emailVerifiedAt: row.email_verified_at,
            lastLoginAt: row.last_login_at, 
        };
    }
}

