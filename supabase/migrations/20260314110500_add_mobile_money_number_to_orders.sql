ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS mobile_money_number VARCHAR(20);
