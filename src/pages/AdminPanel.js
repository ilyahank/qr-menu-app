import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './AdminPanel.css';

export default function AdminPanel() {
  const { userRole, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', tagline: '', color: '#667eea' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userRole && userRole !== 'admin') navigate('/dashboard');
    fetchRestaurants();
  }, [userRole, navigate]);

  const fetchRestaurants = async () => {
    try {
      const { data: restaurantsData, error } = await supabase.from('restaurants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const restaurantsWithOwners = await Promise.all(
        (restaurantsData || []).map(async (restaurant) => {
          const { data: owners } = await supabase.from('users').select('email').eq('restaurant_id', restaurant.id).eq('role', 'owner').limit(1);
          return { ...restaurant, ownerEmail: owners?.[0]?.email || '' };
        })
      );
      setRestaurants(restaurantsWithOwners);
    } catch (error) { console.error(error); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data: restaurantData, error: restaurantError } = await supabase.from('restaurants').insert([{
        name: formData.name, tagline: formData.tagline || '', color: formData.color, logo: '', is_active: true, created_at: new Date()
      }]).select().single();
      if (restaurantError) throw restaurantError;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email, password: formData.password,
        options: { data: { restaurant_id: restaurantData.id, role: 'owner' } }
      });
      if (authError) throw authError;

      if (authData?.user?.id) {
        await supabase.from('users').insert([{
          id: authData.user.id, email: formData.email, restaurant_id: restaurantData.id, role: 'owner', created_at: new Date()
        }]);
      }

      await fetchRestaurants();
      setFormData({ name: '', email: '', password: '', tagline: '', color: '#667eea' });
      setShowForm(false);
      setMessage(t.restaurantCreated);
      setTimeout(() => setMessage(''), 5000);
    } catch (error) { setMessage('Error: ' + error.message); }
    setLoading(false);
  };

  const toggleActive = async (restaurantId, currentStatus) => {
    try {
      const { error } = await supabase.from('restaurants').update({ is_active: !currentStatus }).eq('id', restaurantId);
      if (error) throw error;
      setRestaurants(restaurants.map(r => r.id === restaurantId ? { ...r, is_active: !currentStatus } : r));
    } catch (error) { alert('Error: ' + error.message); }
  };

  const deleteRestaurant = async (restaurantId) => {
    if (window.confirm(t.confirmDelete)) {
      try {
        await supabase.from('menu_items').delete().eq('restaurant_id', restaurantId);
        await supabase.from('categories').delete().eq('restaurant_id', restaurantId);
        await supabase.from('restaurants').delete().eq('id', restaurantId);
        setRestaurants(restaurants.filter(r => r.id !== restaurantId));
      } catch (error) { alert('Error: ' + error.message); }
    }
  };

  if (userRole !== 'admin') return <div>Loading...</div>;

  return (
    <div className="admin-panel">
      <nav className="admin-nav">
        <div className="nav-brand"><h2>{t.adminPanel}</h2></div>
        <div className="nav-links">
          <LangSwitcher />
          <Link to="/admin/approvals" className="nav-link">Approvals</Link>
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>
      <div className="admin-content">
        <div className="admin-header">
          <h1>{t.restaurantManagement}</h1>
          <button onClick={() => setShowForm(true)} className="add-btn">{t.newRestaurant}</button>
        </div>
        {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}
        {showForm && (
          <div className="modal">
            <div className="modal-content">
              <h2>{t.createNewRestaurant}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{t.restaurantName} *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>{t.ownerEmail} *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>{t.password} *</label>
                  <input type="password" name="password" value={formData.password} onChange={handleInputChange} required minLength="6" />
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
                <div className="form-actions">
                  <button type="button" onClick={() => setShowForm(false)} className="cancel-btn">{t.cancel}</button>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? t.creating : t.createRestaurant}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="restaurants-table">
          <table>
            <thead>
              <tr>
                <th>{t.restaurant}</th>
                <th>{t.owner}</th>
                <th>{t.status}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map(restaurant => (
                <tr key={restaurant.id}>
                  <td>
                    <div className="restaurant-info">
                      <div className="color-dot" style={{ backgroundColor: restaurant.color || '#667eea' }} />
                      <div>
                        <div className="restaurant-name">{restaurant.name}</div>
                        <div className="restaurant-tagline">{restaurant.tagline}</div>
                      </div>
                    </div>
                  </td>
                  <td>{restaurant.ownerEmail}</td>
                  <td>
                    <button className={`status-btn ${restaurant.is_active ? 'active' : 'inactive'}`} onClick={() => toggleActive(restaurant.id, restaurant.is_active)}>
                      {restaurant.is_active ? t.active : t.inactive}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => deleteRestaurant(restaurant.id)} className="delete-btn">{t.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {restaurants.length === 0 && !showForm && <div className="empty-state"><p>{t.noRestaurantsYet}</p></div>}
      </div>
    </div>
  );
}
