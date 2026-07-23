-- Add QR code notes columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS dine_in_note TEXT,
ADD COLUMN IF NOT EXISTS delivery_note TEXT;
