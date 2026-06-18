import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './Settings.css';

export default function Settings() {
  const { currentUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [restaurant, setRestaurant] = useState(null);
  const [formData, setFormData] = useState({
    name: '', tagline: '', color: '#667eea', logo: null,
    facebook: '', instagram: '', whatsapp: '', email_contact: ''
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
            whatsapp: restaurantData.whatsapp || '',
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
        whatsapp: formData.whatsapp, email_contact: formData.email_contact, updated_at: new Date()
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
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link active">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>
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
                {formData.whatsapp && <span className="prev-wa"><i className="fab fa-whatsapp"></i></span>}
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
                <label><i className="fab fa-whatsapp"></i> {t.whatsappNumber}</label>
                <input type="text" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} />
                <small>{t.whatsappHint}</small>
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
