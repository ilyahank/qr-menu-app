import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for user in localStorage (our custom session)
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      setUserRole(user.role);
    }
    setLoading(false);
  }, []);

  const signIn = async (username, password) => {
    // Find user by username
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !userData) {
      throw new Error('User not found');
    }

    // Verify password
    if (userData.password !== password) {
      throw new Error('Invalid password');
    }

    // Store user in localStorage
    localStorage.setItem('currentUser', JSON.stringify(userData));
    setCurrentUser(userData);
    setUserRole(userData.role);

    return userData;
  };

  const signOut = async () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setUserRole(null);
  };

  const value = {
    currentUser,
    userRole,
    loading,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
