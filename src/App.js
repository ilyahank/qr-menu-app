import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import { supabase } from './supabase';

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
import { useAuth } from './contexts/AuthContext';

function SubscriptionBanner() {
  const { currentUser, userRole } = useAuth();
  const { t } = useLanguage();
  const [daysLeft, setDaysLeft] = useState(null);
  const [hasSub, setHasSub] = useState(false);

  useEffect(() => {
    if (!currentUser || userRole !== 'owner') {
      setHasSub(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('restaurant_id')
          .eq('id', currentUser.id)
          .single();

        if (userData?.restaurant_id) {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('restaurant_id', userData.restaurant_id)
            .single();

          if (subData) {
            setHasSub(true);
            const end = new Date(subData.end_date);
            const today = new Date();
            const diffTime = end - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysLeft(diffDays);
          } else {
            // Set daysLeft to 0 if no subscription record exists yet
            setHasSub(true);
            setDaysLeft(0);
          }
        }
      } catch (err) {
        console.error('Error fetching subscription in banner:', err);
      }
    };

    fetchSubscription();
    
    // Refresh subscription status periodically or on focus
    const interval = setInterval(fetchSubscription, 60000);
    window.addEventListener('focus', fetchSubscription);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchSubscription);
    };
  }, [currentUser, userRole]);

  if (!hasSub || daysLeft === null || daysLeft > 7) return null;

  const isExpired = daysLeft <= 0;
  const bannerText = isExpired
    ? t.subBannerExpired
    : t.subBannerExpiring.replace('{days}', daysLeft);

  return (
    <div className="subscription-banner" style={{
      backgroundColor: '#dc2626',
      color: '#ffffff',
      padding: '10px 20px',
      textAlign: 'center',
      fontWeight: '600',
      fontSize: '14px',
      zIndex: 99998,
      position: 'sticky',
      top: localStorage.getItem('adminUser') ? '48px' : 0,
      fontFamily: 'sans-serif',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      <span>⚠️ {bannerText}</span>
    </div>
  );
}

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
          <SubscriptionBanner />
          <Routes>
            {/* Public Routes */}
            <Route path="/r/:restaurantId" element={<PublicMenu />} />
            <Route path="/login" element={<Login />} />
            
            {/* Owner Routes */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/dashboard/menu" element={<PrivateRoute><MenuManagement /></PrivateRoute>} />
            <Route path="/dashboard/categories" element={<PrivateRoute><CategoriesManagement /></PrivateRoute>} />
            <Route path="/dashboard/tables" element={<PrivateRoute><TablesManagement /></PrivateRoute>} />
            <Route path="/dashboard/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="/dashboard/qr-code" element={<PrivateRoute><QRCodePage /></PrivateRoute>} />
            <Route path="/dashboard/orders" element={<PrivateRoute><OrdersManagement /></PrivateRoute>} />
            <Route path="/dashboard/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="/admin/approvals" element={<AdminRoute><AdminApprovals /></AdminRoute>} />
            <Route path="/admin/restaurant/:restaurantId" element={<AdminRoute><AdminRestaurantEditor /></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
