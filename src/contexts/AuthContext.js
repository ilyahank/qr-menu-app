import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase';
import { verifyPassword } from '../utils/passwordUtils';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for user session
    const storedUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('authToken');
    
    if (storedUser && token) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setUserRole(user.role);
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (usernameOrEmail, password) => {
    try {
      // Find user by username or email
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
        .single();

      if (error || !userData) {
        throw new Error('Invalid credentials');
      }

      // Verify password with bcrypt
      const isPasswordValid = await verifyPassword(password, userData.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Store secure session
      const userSession = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        restaurant_id: userData.restaurant_id,
        login_time: new Date().toISOString()
      };

      localStorage.setItem('currentUser', JSON.stringify(userSession));
      localStorage.setItem('authToken', 'token_' + Date.now()); // Simple token
      localStorage.setItem('lastActivity', Date.now().toString());

      setCurrentUser(userSession);
      setUserRole(userData.role);

      return userData;
    } catch (error) {
      throw new Error(error.message || 'Login failed');
    }
  };

  const signOut = async () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('lastActivity');
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

  // Session timeout: 30 minutes of inactivity
  useEffect(() => {
    if (!currentUser) return;

    const handleActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const checkSessionTimeout = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || Date.now());
      const inactiveTime = Date.now() - lastActivity;
      const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

      if (inactiveTime > maxInactiveTime) {
        console.warn('Session expired due to inactivity');
        signOut();
      }
    }, 60000); // Check every minute

    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      clearInterval(checkSessionTimeout);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [currentUser]);

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
