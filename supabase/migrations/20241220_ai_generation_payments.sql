-- Create table for AI generation payments
CREATE TABLE IF NOT EXISTS ai_generation_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  amount_usd DECIMAL(10,6) NOT NULL,
  payment_response TEXT NOT NULL,
  images_generated INTEGER NOT NULL DEFAULT 0,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_generation_payments_model ON ai_generation_payments(model);
CREATE INDEX IF NOT EXISTS idx_ai_generation_payments_created_at ON ai_generation_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generation_payments_tx_hash ON ai_generation_payments(tx_hash);

-- Add RLS policies
ALTER TABLE ai_generation_payments ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (for Edge Functions)
CREATE POLICY "Service role can insert ai_generation_payments" ON ai_generation_payments
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Allow service role to read (for Edge Functions)
CREATE POLICY "Service role can read ai_generation_payments" ON ai_generation_payments
  FOR SELECT TO service_role
  USING (true);
