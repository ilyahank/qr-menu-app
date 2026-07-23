import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import LangSwitcher from './LangSwitcher';

export default function MobileDrawer({ isOpen, onClose, onLogout, userRole }) {
  const { t } = useLanguage();
  const location = useLocation();

  const navItems = userRole === 'admin' ? [
    { path: '/admin', label: 'لوحة الإدارة', icon: '🏠' },
    { path: '/admin/approvals', label: 'طلبات التسجيل', icon: '📝' },
  ] : [
    { path: '/dashboard', label: t.dashboard, icon: '🏠' },
    { path: '/dashboard/orders', label: t.orders, icon: '🧾' },
    { path: '/dashboard/analytics', label: t.analytics, icon: '📊' },
    { path: '/dashboard/menu', label: t.menu, icon: '🍔' },
    { path: '/dashboard/categories', label: t.categories, icon: '📂' },
    { path: '/dashboard/tables', label: t.dir === 'rtl' ? 'الطاولات' : 'Tables', icon: '🪑' },
    { path: '/dashboard/qr-code', label: t.qrCode, icon: '📱' },
    { path: '/dashboard/settings', label: t.settings, icon: '⚙️' },
  ];

  return (
    <>
      <div className={`mobile-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <h2>QR Menu</h2>
          <button className="mobile-drawer-close" onClick={onClose}>✕</button>
        </div>
        
        <nav className="mobile-drawer-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-drawer-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="mobile-drawer-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mobile-drawer-footer">
          <LangSwitcher />
          <button className="mobile-drawer-logout" onClick={onLogout}>
            {t.logout}
          </button>
        </div>
      </div>
    </>
  );
}
