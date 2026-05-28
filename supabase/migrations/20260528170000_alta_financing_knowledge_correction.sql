-- Correct durable Scout/KB knowledge for Alta financing.
-- Alta supports property/property-related financing, not the franchise business purchase itself.

INSERT INTO knowledge_documents (title, category, content, priority, token_count, is_active)
VALUES (
  'Alta Financing Scope — Property Financing Only',
  'deal_execution',
  'Alta / Alta Capital should be positioned as a property-financing resource for NAH franchisees and prospects when they are evaluating or funding properties, real estate deals, inventory, or property-related capital needs. Do not describe Alta as financing the initial franchise business purchase, franchise fee, or general franchise acquisition. For buying the franchise business itself, guide the candidate toward appropriate franchise/business funding paths such as SBA, ROBS/retirement rollover, personal liquidity, conventional lending, or other approved franchise-funding partners. If a user asks whether Alta finances the franchise purchase, answer clearly: Alta is for property/property-related financing, not the franchise business purchase.',
  100,
  170,
  true
)
ON CONFLICT (title) DO UPDATE SET
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  priority = EXCLUDED.priority,
  token_count = EXCLUDED.token_count,
  is_active = true,
  updated_at = now();
