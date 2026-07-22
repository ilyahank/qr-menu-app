import React, { useState, useEffect, useCallback } from 'react';
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
  const [restaurantId, setRestaurantId] = useState(null);
  const [stats, setStats] = useState({ menuItems: 0, categories: 0 });
  const [loading, setLoading] = useState(true);

  // Archiving States
  const [unarchivedMonth, setUnarchivedMonth] = useState(null);
  const [unarchivedYear, setUnarchivedYear] = useState(null);
  const [unarchivedMonthName, setUnarchivedMonthName] = useState('');
  const [isArchiveBlocked, setIsArchiveBlocked] = useState(false);
  const [autoArchivedTriggered, setAutoArchivedTriggered] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivedReports, setArchivedReports] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('restaurant_id')
          .eq('id', currentUser.id)
          .single();

        if (userData?.restaurant_id) {
          setRestaurantId(userData.restaurant_id);

          const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', userData.restaurant_id)
            .single();
          setRestaurant(restaurantData);

          const { count: menuCount } = await supabase
            .from('menu_items')
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', userData.restaurant_id);

          const { count: catCount } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', userData.restaurant_id);

          setStats({ menuItems: menuCount || 0, categories: catCount || 0 });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurantData();
  }, [currentUser]);

  const checkArchivingStatus = useCallback(async () => {
    if (!restaurantId) return;

    try {
      const today = new Date();
      // Start of current month in Algeria timezone (approximate standard date logic)
      const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });

      // Check if there are any old daily sales summary rows from previous months
      const { data: oldSummary } = await supabase
        .from('daily_sales_summary')
        .select('date')
        .lt('date', startOfCurrentMonth)
        .order('date', { ascending: true })
        .limit(1);

      if (oldSummary && oldSummary.length > 0) {
        // An unarchived month exists!
        const oldestDate = new Date(oldSummary[0].date);
        const uMonth = oldestDate.getMonth() + 1;
        const uYear = oldestDate.getFullYear();
        
        setUnarchivedMonth(uMonth);
        setUnarchivedYear(uYear);

        const monthNamesAr = ["", "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const monthNamesFr = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        setUnarchivedMonthName(t.dir === 'rtl' ? monthNamesAr[uMonth] : monthNamesFr[uMonth]);

        // If today is after the 7th of the month, we auto-archive in the background
        if (today.getDate() > 7) {
          triggerAutoArchive(restaurantId, uYear, uMonth);
        } else {
          // If within first 7 days, show blocking manual archive modal
          setIsArchiveBlocked(true);
        }
      } else {
        setIsArchiveBlocked(false);
      }
    } catch (e) {
      console.error('Error checking archiving status:', e);
    }
  }, [restaurantId]);
  const fetchArchivedReports = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { data, error } = await supabase
        .from('monthly_totals')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (!error) setArchivedReports(data || []);
    } catch (e) {
      console.error(e);
    }
  }, [restaurantId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (restaurantId) {
      checkArchivingStatus();
      fetchArchivedReports();
    }
  }, [restaurantId, checkArchivingStatus, fetchArchivedReports]);

  const triggerAutoArchive = async (rId, yr, mth) => {
    try {
      setAutoArchivedTriggered(true);
      await fetch(`/api/archive-month?restaurant_id=${rId}&year=${yr}&month=${mth}`, { method: 'POST' });
      // Refresh checks
      setTimeout(() => {
        checkArchivingStatus();
        fetchArchivedReports();
      }, 2000);
    } catch (e) {
      console.error('Auto-archiving failed:', e);
    }
  };

  const handleManualArchive = async () => {
    if (!restaurantId || !unarchivedYear || !unarchivedMonth) return;
    setArchiveLoading(true);
    try {
      const response = await fetch(`/api/archive-month?restaurant_id=${restaurantId}&year=${unarchivedYear}&month=${unarchivedMonth}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (response.ok && data.pdfUrl) {
        // Trigger file download in browser
        window.open(data.pdfUrl, '_blank');
        alert(t.dir === 'rtl' ? 'تم أرشفة الشهر بنجاح وتنزيل تقرير الـ PDF!' : 'Month archived successfully and PDF report downloaded!');
        
        setIsArchiveBlocked(false);
        setUnarchivedMonth(null);
        setUnarchivedYear(null);
        
        // Refresh stats and report history list
        await fetchArchivedReports();
        await checkArchivingStatus();
      } else {
        alert('Error: ' + (data.error || 'Failed to archive'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error during archiving: ' + err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div className="dashboard-container" style={{ direction: t.dir }}>
      
      {/* AUTO ARCHIVE NOTIFICATION BANNER */}
      {autoArchivedTriggered && (
        <div className="auto-archive-banner" style={{
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          padding: '10px 20px',
          textAlign: 'center',
          fontWeight: '600',
          fontSize: '13px',
          zIndex: 9999,
          fontFamily: 'sans-serif'
        }}>
          <span>ℹ️ {t.autoArchivedNotice}</span>
        </div>
      )}

      {/* DASHBOARD NAVBAR */}
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link active">{t.dashboard}</Link>
          <Link to="/dashboard/orders" className="nav-link">{t.orders}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>

      {/* MANDATORY BLOCKING OVERLAY FOR PRE-7th DAY ARCHIVING */}
      {isArchiveBlocked && (
        <div className="archive-blocking-overlay">
          <div className="archive-block-card" style={{ direction: t.dir, textAlign: t.dir === 'rtl' ? 'right' : 'left' }}>
            <div className="block-warning-icon">⚠️</div>
            <h2>{t.archiveAlertTitle}</h2>
            <p className="warning-text">
              {t.archiveAlertMessage}
            </p>
            <div className="report-target-box" style={{ background: '#fef3c7', padding: '15px', borderRadius: '10px', margin: '15px 0', border: '1px solid #f59e0b' }}>
              <strong>{t.reportNotification.replace('{month}', `${unarchivedMonthName} ${unarchivedYear}`)}</strong>
            </div>
            <button 
              onClick={handleManualArchive} 
              className="download-archive-btn"
              disabled={archiveLoading}
            >
              {archiveLoading ? (t.dir === 'rtl' ? 'جاري الأرشفة وتوليد الملف...' : 'Archiving & Generating...') : t.downloadReportBtn}
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>{t.welcomeBack}</h1>
            {restaurant && <div className="restaurant-info"><h2>{restaurant.name}</h2><p>{restaurant.tagline}</p></div>}
          </div>
          {/* Quick link to Analytics page */}
          <Link to="/dashboard/analytics" className="submit-btn" style={{ textDecoration: 'none', background: '#4f46e5' }}>
            📊 {t.analytics}
          </Link>
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
            <Link to="/dashboard/orders" className="action-card"><div className="action-icon">📦</div><div>{t.orders}</div></Link>
            <Link to="/dashboard/menu" className="action-card"><div className="action-icon">🍔</div><div>{t.addMenuItem}</div></Link>
            <Link to="/dashboard/categories" className="action-card"><div className="action-icon">📂</div><div>{t.manageCategories}</div></Link>
            <Link to="/dashboard/qr-code" className="action-card"><div className="action-icon">📱</div><div>{t.viewQRCode}</div></Link>
          </div>
        </div>

        {/* HISTORICAL ARCHIVED REPORTS SECTION */}
        <div className="archived-reports-section" style={{ marginTop: '40px' }}>
          <h3>📂 {t.reportHistory}</h3>
          <div className="reports-table-wrapper" style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginTop: '15px' }}>
            {archivedReports.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0', color: '#666' }}>
                    <th style={{ textAlign: t.dir === 'rtl' ? 'right' : 'left', padding: '12px' }}>الشهر / Month</th>
                    <th style={{ textAlign: t.dir === 'rtl' ? 'right' : 'left', padding: '12px' }}>السنة / Year</th>
                    <th style={{ textAlign: t.dir === 'rtl' ? 'right' : 'left', padding: '12px' }}>إجمالي الطلبات</th>
                    <th style={{ textAlign: t.dir === 'rtl' ? 'right' : 'left', padding: '12px' }}>إجمالي المبيعات</th>
                    <th style={{ textAlign: t.dir === 'rtl' ? 'right' : 'left', padding: '12px' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedReports.map(rep => {
                    const monthNamesAr = ["", "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
                    const monthNamesFr = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
                    const mName = t.dir === 'rtl' ? monthNamesAr[rep.month] : monthNamesFr[rep.month];

                    return (
                      <tr key={rep.id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>{mName}</td>
                        <td style={{ padding: '12px' }}>{rep.year}</td>
                        <td style={{ padding: '12px' }}>{rep.total_orders}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#10b981' }}>{parseFloat(rep.total_revenue).toFixed(0)} {t.currency}</td>
                        <td style={{ padding: '12px' }}>
                          {rep.pdf_url && (
                            <a 
                              href={rep.pdf_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="print-btn customer"
                              style={{ display: 'inline-flex', padding: '6px 12px', textDecoration: 'none', fontSize: '12px' }}
                            >
                              📥 {t.downloadPdf}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: '#999', margin: '20px 0' }}>
                {t.dir === 'rtl' ? 'لا توجد تقارير مؤرشفة حالياً.' : 'No archived reports available.'}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
