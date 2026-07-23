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
import OrdersManagement from './pages/OrdersManagement';
import Analytics from './pages/Analytics';

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
            
            {/* Owner Routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/dashboard/menu" element={<PrivateRoute><MenuManagement /></PrivateRoute>} />
            <Route path="/dashboard/categories" element={<PrivateRoute><CategoriesManagement /></PrivateRoute>} />
            <Route path="/dashboard/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/dashboard/qr-code" element={<PrivateRoute><QRCodePage /></PrivateRoute>} />
            <Route path="/dashboard/orders" element={<PrivateRoute><OrdersManagement /></PrivateRoute>} />
            <Route path="/dashboard/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            
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
