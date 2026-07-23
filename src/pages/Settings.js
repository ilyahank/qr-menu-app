import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import MobileDrawer from '../components/MobileDrawer';
import './Settings.css';

export default function Settings() {
  const { currentUser, signOut, userRole } = useAuth();
  const { t } = useLanguage();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [formData, setFormData] = useState({
    name: '', tagline: '', color: '#667eea', logo: null,
    facebook: '', instagram: '', phone: '', email_contact: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase.from('users').select('restaurant_id').eq('id', currentUser.id).single();
        if (userData?.restaurant_id) {
          const { data: restaurantData } = await supabase.from('restaurants').select('*').eq('id', userData.restaurant_id).single();
          setRestaurant(restaurantData);
          setFormData({
            name: restaurantData.name || '',
            tagline: restaurantData.tagline || '',
            color: restaurantData.color || '#667eea',
            logo: null,
            facebook: restaurantData.facebook || '',
            instagram: restaurantData.instagram || '',
            phone: restaurantData.phone || '',
            email_contact: restaurantData.email_contact || ''
          });
        }
      } catch (error) { console.error(error); }
    };
    fetchRestaurant();
  }, [currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, logo: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      let logoUrl = restaurant?.logo || '';
      if (formData.logo) {
        const fileExt = formData.logo.name.split('.').pop();
        const filePath = `logos/${restaurant.id}/${Date.now()}.${fileExt}`;
        await supabase.storage.from('restaurant-logos').upload(filePath, formData.logo);
        const { data: { publicUrl } } = supabase.storage.from('restaurant-logos').getPublicUrl(filePath);
        logoUrl = publicUrl;
      }
      const { error } = await supabase.from('restaurants').update({
        name: formData.name, tagline: formData.tagline, color: formData.color,
        logo: logoUrl, facebook: formData.facebook, instagram: formData.instagram,
        phone: formData.phone, email_contact: formData.email_contact, updated_at: new Date()
      }).eq('id', restaurant.id);
      if (error) throw error;
      setMessage(t.settingsUpdated);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) { setMessage('Error: ' + error.message); }
    setLoading(false);
  };

  return (
    <div className="settings-page">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <button className="mobile-menu-btn" onClick={() => setMobileDrawerOpen(true)}>☰</button>
          <h2>IRM</h2>
        </div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/orders" className="nav-link">{t.orders}</Link>
          <Link to="/dashboard/analytics" className="nav-link">{t.analytics}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/tables" className="nav-link">{t.dir === 'rtl' ? 'الطاولات' : 'Tables'}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link active">{t.settings}</Link>
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
      <div className="settings-content">
        <div className="settings-header"><h1>{t.restaurantSettings}</h1></div>
        {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}
        <div className="settings-form-container">
          <div className="preview-section">
            <h3>{t.livePreview}</h3>
            <div className="preview-card" style={{ borderColor: formData.color }}>
              <div className="preview-logo">
                {formData.logo ? <img src={URL.createObjectURL(formData.logo)} alt="Preview" />
                  : restaurant?.logo ? <img src={restaurant.logo} alt="Restaurant" />
                  : <div className="preview-placeholder">{formData.name?.charAt(0) || 'L'}</div>}
              </div>
              <h2 style={{ color: formData.color }}>{formData.name || t.restaurantName}</h2>
              <p className="preview-tagline">{formData.tagline || t.tagline}</p>
              <div className="preview-social">
                {formData.facebook && <span className="prev-fb"><i className="fab fa-facebook-f"></i></span>}
                {formData.instagram && <span className="prev-ig"><i className="fab fa-instagram"></i></span>}
                {formData.phone && <span className="prev-phone"><i className="fas fa-phone"></i></span>}
                {formData.email_contact && <span className="prev-em"><i className="fas fa-envelope"></i></span>}
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="settings-form">
            <div className="form-group">
              <label>{t.restaurantName} *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>{t.tagline}</label>
              <input type="text" name="tagline" value={formData.tagline} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>{t.themeColor}</label>
              <div className="color-picker-wrapper">
                <input type="color" name="color" value={formData.color} onChange={handleInputChange} className="color-picker" />
                <span className="color-value">{formData.color}</span>
              </div>
            </div>
            <div className="form-group">
              <label>{t.logoImage}</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />
            </div>
            <div className="social-section">
              <h3>{t.socialContact}</h3>
              <div className="form-group">
                <label><i className="fab fa-facebook"></i> {t.facebookUrl}</label>
                <input type="url" name="facebook" value={formData.facebook} onChange={handleInputChange} placeholder="https://facebook.com/yourpage" />
              </div>
              <div className="form-group">
                <label><i className="fab fa-instagram"></i> {t.instagramUrl}</label>
                <input type="url" name="instagram" value={formData.instagram} onChange={handleInputChange} placeholder="https://instagram.com/yourpage" />
              </div>
              <div className="form-group">
                <label><i className="fas fa-phone"></i> Phone Number</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+1234567890" />
                <small>Customers can call directly from the menu</small>
              </div>
              <div className="form-group">
                <label><i className="fas fa-envelope"></i> {t.contactEmail}</label>
                <input type="email" name="email_contact" value={formData.email_contact} onChange={handleInputChange} />
              </div>
            </div>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? t.saving2 : t.saveChanges}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
