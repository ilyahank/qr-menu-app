// Transaction Helper for Critical Database Operations
// Ensures data consistency by using database transactions

import { supabase } from '../supabase';

export const withTransaction = async (operation) => {
  // Note: Supabase client-side doesn't support true transactions
  // For server-side operations, use PostgreSQL functions with BEGIN/COMMIT
  // This is a wrapper for operations that should be atomic
  
  try {
    const result = await operation();
    return { success: true, data: result };
  } catch (error) {
    console.error('Transaction failed:', error);
    return { success: false, error: error.message };
  }
};

// Example PostgreSQL function for transaction-safe restaurant deletion
// Run this in Supabase SQL Editor:
/*
CREATE OR REPLACE FUNCTION safe_delete_restaurant(p_restaurant_id UUID)
RETURNS VOID AS $$
DECLARE
    restaurant_name TEXT;
BEGIN
    -- Get restaurant name for logging
    SELECT name INTO restaurant_name 
    FROM public.restaurants 
    WHERE id = p_restaurant_id;
    
    -- Start transaction (implicit in PostgreSQL function)
    
    -- Soft delete restaurant
    UPDATE public.restaurants 
    SET deleted_at = NOW() 
    WHERE id = p_restaurant_id;
    
    -- Log the deletion
    INSERT INTO public.error_logs (log_type, message, context)
    VALUES ('info', 'Restaurant soft deleted', 
            jsonb_build_object('restaurant_id', p_restaurant_id, 'restaurant_name', restaurant_name));
    
    -- Transaction commits automatically on success
END;
$$ LANGUAGE plpgsql;
*/

export const executeTransaction = async (sql, params = []) => {
  // Execute raw SQL with transaction support
  // This requires server-side implementation or Supabase RPC
  
  try {
    const { data, error } = await supabase.rpc('execute_transaction', {
      sql_query: sql,
      params: params
    });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Transaction execution failed:', error);
    return { success: false, error: error.message };
  }
};
