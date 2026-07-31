-- Recreate owner accounts for all restaurants that don't have one
-- This will create owner accounts with username = restaurant name (lowercase, no spaces)
-- Default password: password123 (change this after login)

-- First, let's see which restaurants exist
SELECT 'Restaurants that need owner accounts:' as info;
SELECT id, name FROM public.restaurants;

-- Create owner accounts for restaurants (you'll need to customize usernames/passwords)
-- Example for Family Tea (replace with actual restaurant IDs from above query)

-- For Family Tea (you'll need the actual restaurant_id from the query above)
INSERT INTO public.users (id, username, password_hash, password, email, restaurant_id, role, status, created_at)
VALUES (
  gen_random_uuid(),
  'familytea',  -- Change this username
  '$2b$10$YourHashedPasswordHere',  -- You need to hash the password first
  '',  -- Don't store plain text
  'familytea@qrmenu.local',
  'RESTAURANT_ID_HERE',  -- Replace with actual restaurant_id
  'owner',
  'approved',
  NOW()
)
ON CONFLICT DO NOTHING;

-- For Sham Restaurant
INSERT INTO public.users (id, username, password_hash, password, email, restaurant_id, role, status, created_at)
VALUES (
  gen_random_uuid(),
  'shamrestaurant',  -- Change this username
  '$2b$10$YourHashedPasswordHere',  -- You need to hash the password first
  '',  -- Don't store plain text
  'shamrestaurant@qrmenu.local',
  'RESTAURANT_ID_HERE',  -- Replace with actual restaurant_id
  'owner',
  'approved',
  NOW()
)
ON CONFLICT DO NOTHING;
