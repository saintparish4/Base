-- Create settlements table for batched payouts to merchants
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount DECIMAL(18, 6) NOT NULL,
    fee_amount DECIMAL(18, 6) NOT NULL,
    net_amount DECIMAL(18, 6) NOT NULL,
    transaction_count INTEGER NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    settlement_hash VARCHAR(66), -- Transaction hash for settlement
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT
);

-- Create settlement_payments junction table
CREATE TABLE IF NOT EXISTS settlement_payments (
    settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    PRIMARY KEY (settlement_id, payment_id)
);

-- Create indexes
CREATE INDEX idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX idx_settlements_created_at ON settlements(created_at);