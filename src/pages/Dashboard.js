import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './Dashboard.css';

export default function Dashboard() {
  const { currentUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [restaurant, setRestaurant] = useState(null);
  const [stats, setStats] = useState({ menuItems: 0, categories: 0 });

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase.from('users').select('restaurant_id').eq('id', currentUser.id).single();
        if (userData?.restaurant_id) {
          const { data: restaurantData } = await supabase.from('restaurants').select('*').eq('id', userData.restaurant_id).single();
          setRestaurant(restaurantData);
          const { count: menuCount } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', userData.restaurant_id);
          const { count: catCount } = await supabase.from('categories').select('*', { count: 'exact', head: true }).eq('restaurant_id', userData.restaurant_id);
          setStats({ menuItems: menuCount || 0, categories: catCount || 0 });
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchRestaurantData();
  }, [currentUser]);

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link active">{t.dashboard}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>
      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1>{t.welcomeBack}</h1>
          {restaurant && <div className="restaurant-info"><h2>{restaurant.name}</h2><p>{restaurant.tagline}</p></div>}
        </header>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-number">{stats.menuItems}</div><div className="stat-label">{t.menuItems}</div></div>
          <div className="stat-card"><div className="stat-number">{stats.categories}</div><div className="stat-label">{t.categoriesCount}</div></div>
          <div className="stat-card"><div className="stat-number">1</div><div className="stat-label">{t.restaurant}</div></div>
          <div className="stat-card"><div className="stat-number">📱</div><div className="stat-label">{t.qrCodeActive}</div></div>
        </div>
        <div className="quick-actions">
          <h3>{t.quickActions}</h3>
          <div className="action-grid">
            <Link to="/dashboard/menu" className="action-card"><div className="action-icon">🍔</div><div>{t.addMenuItem}</div></Link>
            <Link to="/dashboard/categories" className="action-card"><div className="action-icon">📂</div><div>{t.manageCategories}</div></Link>
            <Link to="/dashboard/qr-code" className="action-card"><div className="action-icon">📱</div><div>{t.viewQRCode}</div></Link>
            <Link to="/dashboard/settings" className="action-card"><div className="action-icon">⚙️</div><div>{t.settings}</div></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
