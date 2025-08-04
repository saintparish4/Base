export interface Payment {
    id: string;
    merchantId: string;
    externalId?: string;
    amount: number;
    currency: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'cancelled';
    paymentUrl?: string;
    qrCodeData?: string;
    expiresAt?: Date;
    customerEmail?: string;
    customerPhone?: string;
    description?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    cancelledAt?: Date; 
}

export interface CreatePaymentRequest {
    amount: number;
    currency?: string;
    externalId?: string;
    expiresIn?: number; // in minutes
    customerEmail?: string;
    customerPhone?: string;
    description?: string;
    metadata?: Record<string, any>;
    redirectUrl?: string; 
}

export interface Transaction {
    id: string;
    paymentId: string;
    transactionHash: string;
    network: 'ethereum' | 'polygon';
    fromAddress: string;
    toAddress: string;
    amount: number;
    gasUsed?: number;
    gasPrice?: number;
    blockNumber?: number;
    blockHash?: string;
    confirmationCount: number;
    status: 'pending' | 'confirmed' | 'failed';
    createdAt: Date;
    confirmedAt?: Date;
    failedAt?: Date;
    errorMessage?: string;
}
