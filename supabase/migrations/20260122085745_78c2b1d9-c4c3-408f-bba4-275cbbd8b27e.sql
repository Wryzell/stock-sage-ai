-- Create competitor_prices table for tracking competitor pricing
CREATE TABLE public.competitor_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  competitor_name TEXT NOT NULL CHECK (competitor_name IN ('Octagon', 'Villman', 'PC Express')),
  price DECIMAL(12,2) NOT NULL,
  source_url TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_history table for tracking our own price changes
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price DECIMAL(12,2) NOT NULL,
  new_price DECIMAL(12,2) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID
);

-- Enable RLS on both tables
ALTER TABLE public.competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for competitor_prices (all authenticated users can view, admins can modify)
CREATE POLICY "Authenticated users can view competitor prices" 
ON public.competitor_prices 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can insert competitor prices" 
ON public.competitor_prices 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update competitor prices" 
ON public.competitor_prices 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete competitor prices" 
ON public.competitor_prices 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS policies for price_history (all authenticated users can view)
CREATE POLICY "Authenticated users can view price history" 
ON public.price_history 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "System can insert price history" 
ON public.price_history 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_competitor_prices_product ON public.competitor_prices(product_id);
CREATE INDEX idx_competitor_prices_competitor ON public.competitor_prices(competitor_name);
CREATE INDEX idx_price_history_product ON public.price_history(product_id);