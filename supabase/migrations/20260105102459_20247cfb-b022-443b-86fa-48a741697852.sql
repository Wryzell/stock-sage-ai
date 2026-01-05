-- Remove customer_type column from sales table
ALTER TABLE public.sales DROP COLUMN IF EXISTS customer_type;