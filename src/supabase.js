import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hdbewuhbpkfbhowaduun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYmV3dWhicGtmYmhvd2FkdXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDI5MzQsImV4cCI6MjA5NzIxODkzNH0.RhaY4nmyvedimY4RhZcjWtm0SopnTWleW4zYUl0NYHc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getUserRole = async (userId) => {
  console.log('getUserRole called with:', userId);
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  
  console.log('getUserRole result:', data, 'error:', error);
  if (error) return null;
  return data?.role || 'owner';
};
