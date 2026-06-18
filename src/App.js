import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

// Public Pages
import PublicMenu from './pages/PublicMenu';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import WaitingApproval from './pages/WaitingApproval';
import AdminApprovals from './pages/AdminApprovals';

// Owner Dashboard
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import CategoriesManagement from './pages/CategoriesManagement';
import Settings from './pages/Settings';
import QRCodePage from './pages/QRCodePage';

// Admin Panel
import AdminPanel from './pages/AdminPanel';

import './App.css';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/r/:restaurantId" element={<PublicMenu />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/waiting-approval" element={<WaitingApproval />} />
            
            {/* Owner Routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/dashboard/menu" element={<PrivateRoute><MenuManagement /></PrivateRoute>} />
            <Route path="/dashboard/categories" element={<PrivateRoute><CategoriesManagement /></PrivateRoute>} />
            <Route path="/dashboard/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/dashboard/qr-code" element={<PrivateRoute><QRCodePage /></PrivateRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="/admin/approvals" element={<AdminRoute><AdminApprovals /></AdminRoute>} />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
