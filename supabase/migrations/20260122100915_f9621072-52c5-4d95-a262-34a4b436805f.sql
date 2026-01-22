
-- Add soft delete columns to products table
ALTER TABLE public.products 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL,
ADD COLUMN deleted_by uuid DEFAULT NULL;

-- Add soft delete columns to sales table
ALTER TABLE public.sales 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL,
ADD COLUMN deleted_by uuid DEFAULT NULL;

-- Create index for faster queries on non-deleted items
CREATE INDEX idx_products_deleted_at ON public.products(deleted_at);
CREATE INDEX idx_sales_deleted_at ON public.sales(deleted_at);

-- Update RLS policy for permanent delete - only admins can permanently delete
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
CREATE POLICY "Admins can permanently delete products" 
ON public.products 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete sales" ON public.sales;
CREATE POLICY "Admins can permanently delete sales" 
ON public.sales 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));
