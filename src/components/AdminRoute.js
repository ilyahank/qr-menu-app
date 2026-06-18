import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }) {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  
  return currentUser && userRole === 'admin' ? children : <Navigate to="/login" />;
}
