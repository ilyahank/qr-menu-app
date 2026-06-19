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
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', userId)
      .single();
    
    console.log('getUserRole result:', data, 'error:', error);
    
    if (error) {
      console.error('Error fetching role:', error);
      return 'owner';
    }
    
    // Check if it's the admin email
    if (data?.email === 'ilyashannouna@gmail.com') {
      return 'admin';
    }
    
    return data?.role || 'owner';
  } catch (error) {
    console.error('Exception in getUserRole:', error);
    return 'owner';
  }
};
