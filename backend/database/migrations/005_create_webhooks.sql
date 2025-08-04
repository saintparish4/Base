-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- payment.completed, payment.failed, etc.
    resource_id UUID NOT NULL, -- ID of the related resource (payment, settlement, etc.)
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, delivered, failed
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_attempt_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    response_status INTEGER,
    response_body TEXT
);

-- Create indexes
CREATE INDEX idx_webhook_events_merchant_id ON webhook_events(merchant_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_next_attempt ON webhook_events(next_attempt_at);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);