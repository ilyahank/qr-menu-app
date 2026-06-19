import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

// Pages
import PublicMenu from './pages/PublicMenu';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import AdminApprovals from './pages/AdminApprovals';
import AdminRestaurantEditor from './pages/AdminRestaurantEditor';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import CategoriesManagement from './pages/CategoriesManagement';
import Settings from './pages/Settings';
import QRCodePage from './pages/QRCodePage';

import './App.css';
import { useAuth } from './contexts/AuthContext';

function ImpersonationBanner() {
  const { currentUser, exitImpersonation } = useAuth();
  const isAdminImpersonating = localStorage.getItem('adminUser');

  if (!isAdminImpersonating) return null;

  return (
    <div className="impersonation-banner" style={{
      backgroundColor: '#e02424',
      color: '#fff',
      padding: '12px 20px',
      textAlign: 'center',
      fontWeight: '600',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 99999,
      position: 'sticky',
      top: 0,
      fontFamily: 'sans-serif',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <span>⚠️ Impersonating Owner: {currentUser?.username || currentUser?.email}</span>
      <button onClick={() => {
        exitImpersonation();
        window.location.href = '/admin';
      }} style={{
        backgroundColor: '#fff',
        color: '#e02424',
        border: 'none',
        padding: '6px 14px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'all 0.2s'
      }}>
        Return to Admin Panel
      </button>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <ImpersonationBanner />
          <Routes>
            {/* Public Routes */}
            <Route path="/r/:restaurantId" element={<PublicMenu />} />
            <Route path="/login" element={<Login />} />
            
            {/* Owner Routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/dashboard/menu" element={<PrivateRoute><MenuManagement /></PrivateRoute>} />
            <Route path="/dashboard/categories" element={<PrivateRoute><CategoriesManagement /></PrivateRoute>} />
            <Route path="/dashboard/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/dashboard/qr-code" element={<PrivateRoute><QRCodePage /></PrivateRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="/admin/approvals" element={<AdminRoute><AdminApprovals /></AdminRoute>} />
            <Route path="/admin/restaurant/:restaurantId" element={<AdminRoute><AdminRestaurantEditor /></AdminRoute>} />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
