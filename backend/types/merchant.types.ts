export interface Merchant {
  id: string;
  email: string;
  businessName: string;
  businessType?: string;
  businessAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactPhone?: string;
  status: "pending_verification" | "active" | "suspended" | "closed";
  kycStatus: "pending" | "in_review" | "approved" | "rejected";
  kycData?: Record<string, any>;
  apiKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  settlementAddress?: string;
  settlementSchedule?: "daily" | "weekly" | "monthly";
  feeRate: number;
  createdAt: Date;
  updatedAt: Date;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
}

export interface CreateMerchantRequest {
  email: string;
  password: string;
  businessName: string;
  businessType?: string;
  contactPhone?: string;
  businessAddress?: Merchant["businessAddress"];
}

export interface UpdateMerchantRequest {
  businessName?: string;
  businessType?: string;
  contactPhone?: string;
  businessAddress?: Merchant["businessAddress"];
  webhookUrl?: string;
  settlementAddress?: string;
  settlementSchedule?: Merchant["settlementSchedule"];
}
