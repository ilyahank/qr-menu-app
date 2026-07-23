import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode.react';
import LangSwitcher from '../components/LangSwitcher';
import MobileDrawer from '../components/MobileDrawer';
import './QRCodePage.css';

export default function QRCodePage() {
  const { currentUser, signOut, userRole } = useAuth();
  const { t } = useLanguage();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [takeawayQrUrl, setTakeawayQrUrl] = useState('');
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'takeaway'
  const [dineInNote, setDineInNote] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase.from('users').select('restaurant_id').eq('id', currentUser.id).single();
        if (userData?.restaurant_id) {
          setRestaurantId(userData.restaurant_id);
          const { data: restaurantData } = await supabase.from('restaurants').select('*').eq('id', userData.restaurant_id).single();
          setRestaurant(restaurantData);
          setQrUrl(`${window.location.origin}/r/${restaurantData.id}`);
          setTakeawayQrUrl(`${window.location.origin}/r/${restaurantData.id}?takeaway=true`);
          setDineInNote(restaurantData.dine_in_note || '');
          setDeliveryNote(restaurantData.delivery_note || '');
        }
      } catch (error) { console.error(error); }
    };
    fetchRestaurant();
  }, [currentUser]);

  const saveNotes = async () => {
    if (!restaurant) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          dine_in_note: dineInNote,
          delivery_note: deliveryNote
        })
        .eq('id', restaurant.id);
      
      if (error) throw error;
      alert(t.dir === 'rtl' ? 'تم حفظ الملاحظات بنجاح' : 'Notes saved successfully');
    } catch (error) {
      console.error(error);
      alert(t.dir === 'rtl' ? 'فشل حفظ الملاحظات' : 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadQR = (type) => {
    const canvasId = type === 'takeaway' ? 'qr-code-takeaway' : 'qr-code';
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = type === 'takeaway' ? `qr-takeaway-${restaurantId}.png` : `qr-menu-${restaurantId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="qr-page" style={{ direction: t.dir }}>
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <button className="mobile-menu-btn" onClick={() => setMobileDrawerOpen(true)}>☰</button>
          <h2>QR Menu</h2>
        </div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/tables" className="nav-link">{t.dir === 'rtl' ? 'الطاولات' : 'Tables'}</Link>
          <Link to="/dashboard/qr-code" className="nav-link active">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>

      <MobileDrawer 
        isOpen={mobileDrawerOpen} 
        onClose={() => setMobileDrawerOpen(false)} 
        onLogout={signOut}
        userRole={userRole}
      />
      <div className="qr-content">
        <div className="qr-header"><h1>{t.qrCodeTitle}</h1></div>
        
        {/* Tab Navigation */}
        <div className="qr-tabs">
          <button
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            {t.dir === 'rtl' ? 'منيو الطاولة' : 'Table Menu'}
          </button>
          <button
            className={`tab-btn ${activeTab === 'takeaway' ? 'active' : ''}`}
            onClick={() => setActiveTab('takeaway')}
          >
            {t.dir === 'rtl' ? 'منيو التوصيل' : 'Takeaway'}
          </button>
        </div>

        <div className="qr-container">
          {activeTab === 'general' ? (
            <div className="qr-card">
              {restaurant && <div className="qr-info"><h2>{restaurant.name}</h2><p>{t.scanQR}</p></div>}
              <div className="qr-display">
                {qrUrl && <QRCode id="qr-code" value={qrUrl} size={256} level="H" includeMargin={true} />}
              </div>
              <div className="qr-actions">
                <button onClick={() => downloadQR('general')} className="download-btn">{t.downloadQR}</button>
                <div className="qr-url"><p>{t.qrUrl}</p><code>{qrUrl}</code></div>
              </div>
              <div className="qr-note-section">
                <h3>{t.dir === 'rtl' ? 'ملاحظة للطباعة' : 'Print Note'}</h3>
                <textarea
                  value={dineInNote}
                  onChange={(e) => setDineInNote(e.target.value)}
                  placeholder={t.dir === 'rtl' ? 'اكتب ملاحظة صغيرة للطباعة بجانب رمز QR...' : 'Write a small note to print next to the QR code...'}
                  rows="2"
                  className="qr-note-input"
                />
              </div>
              <div className="qr-instructions">
                <h3>{t.howToUse}</h3>
                <ol>
                  <li>{t.qrStep1}</li>
                  <li>{t.qrStep2}</li>
                  <li>{t.qrStep3}</li>
                  <li>{t.qrStep4}</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="qr-card">
              {restaurant && <div className="qr-info"><h2>{restaurant.name}</h2><p>{t.dir === 'rtl' ? 'منيو التوصيل - امسح للطلب' : 'Takeaway Menu - Scan to Order'}</p></div>}
              <div className="qr-display">
                {takeawayQrUrl && <QRCode id="qr-code-takeaway" value={takeawayQrUrl} size={256} level="H" includeMargin={true} />}
              </div>
              <div className="qr-actions">
                <button onClick={() => downloadQR('takeaway')} className="download-btn">{t.downloadQR}</button>
                <div className="qr-url"><p>{t.qrUrl}</p><code>{takeawayQrUrl}</code></div>
              </div>
              <div className="qr-note-section">
                <h3>{t.dir === 'rtl' ? 'ملاحظة للطباعة' : 'Print Note'}</h3>
                <textarea
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder={t.dir === 'rtl' ? 'اكتب ملاحظة صغيرة للطباعة بجانب رمز QR...' : 'Write a small note to print next to the QR code...'}
                  rows="2"
                  className="qr-note-input"
                />
              </div>
              <div className="qr-instructions">
                <h3>{t.dir === 'rtl' ? 'كيفية الاستخدام للتوصيل:' : 'How to use for Takeaway:'}</h3>
                <ol>
                  <li>{t.dir === 'rtl' ? 'حمّل صورة رمز QR' : 'Download the QR code image'}</li>
                  <li>{t.dir === 'rtl' ? 'اطبعها أو اعرضها للزبائن' : 'Print it or display it for customers'}</li>
                  <li>{t.dir === 'rtl' ? 'الزبائن يمسحون الرمز لطلب الطعام' : 'Customers scan to order food'}</li>
                  <li>{t.dir === 'rtl' ? 'يحددون وقت الاستلام' : 'They select pickup time'}</li>
                </ol>
              </div>
            </div>
          )}
          <div className="qr-sidebar">
            <div className="tip-card">
              <h3>{t.tips}</h3>
              <ul>
                <li>{t.tip1}</li>
                <li>{t.tip2}</li>
                <li>{t.tip3}</li>
                <li>{t.tip4}</li>
              </ul>
            </div>
            <button onClick={saveNotes} className="save-notes-btn" disabled={isSaving}>
              {isSaving ? (t.dir === 'rtl' ? 'جاري الحفظ...' : 'Saving...') : (t.dir === 'rtl' ? 'حفظ الملاحظات' : 'Save Notes')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
