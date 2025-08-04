-- Create transactions table for blockchain transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL, --Ethereum tx hash
    network VARCHAR(50) NOT NULL, -- 'ethereum' or 'polygon'
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    gas_used BIGINT,
    gas_price BIGINT, -- Wei 
    block_number BIGINT,
    block_hash VARCHAR(66),
    confirmation_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT
);

-- Create indexes
CREATE INDEX idx_transactions_payment_id ON transactions(payment_id);
CREATE INDEX idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX idx_transactions_network ON transactions(network);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_block_number ON transactions(block_number);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);