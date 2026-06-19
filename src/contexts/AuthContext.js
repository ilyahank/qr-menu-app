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

  const signIn = async (usernameOrEmail, password) => {
    // Find user by username or email
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
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
    localStorage.removeItem('adminUser');
    setCurrentUser(null);
    setUserRole(null);
  };

  const impersonate = async (ownerUser) => {
    // Store current admin user as adminUser
    if (currentUser && userRole === 'admin') {
      localStorage.setItem('adminUser', JSON.stringify(currentUser));
    }
    // Set the impersonated owner as current user
    localStorage.setItem('currentUser', JSON.stringify(ownerUser));
    setCurrentUser(ownerUser);
    setUserRole('owner');
  };

  const exitImpersonation = async () => {
    const storedAdmin = localStorage.getItem('adminUser');
    if (storedAdmin) {
      const adminUser = JSON.parse(storedAdmin);
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      localStorage.removeItem('adminUser');
      setCurrentUser(adminUser);
      setUserRole('admin');
    }
  };

  const value = {
    currentUser,
    userRole,
    loading,
    signIn,
    signOut,
    impersonate,
    exitImpersonation
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
