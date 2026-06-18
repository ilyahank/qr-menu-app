import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode.react';
import LangSwitcher from '../components/LangSwitcher';
import './QRCodePage.css';

export default function QRCodePage() {
  const { currentUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [qrUrl, setQrUrl] = useState('');

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
        }
      } catch (error) { console.error(error); }
    };
    fetchRestaurant();
  }, [currentUser]);

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code');
    if (canvas) {
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `qr-menu-${restaurantId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="qr-page">
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/qr-code" className="nav-link active">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>
      <div className="qr-content">
        <div className="qr-header"><h1>{t.qrCodeTitle}</h1></div>
        <div className="qr-container">
          <div className="qr-card">
            {restaurant && <div className="qr-info"><h2>{restaurant.name}</h2><p>{t.scanQR}</p></div>}
            <div className="qr-display">
              {qrUrl && <QRCode id="qr-code" value={qrUrl} size={256} level="H" includeMargin={true} />}
            </div>
            <div className="qr-actions">
              <button onClick={downloadQR} className="download-btn">{t.downloadQR}</button>
              <div className="qr-url"><p>{t.qrUrl}</p><code>{qrUrl}</code></div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
