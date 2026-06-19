import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './AdminPanel.css';

export default function AdminPanel() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    username: '', 
    password: '', 
    tagline: '', 
    color: '#667eea' 
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userRole && userRole !== 'admin') navigate('/dashboard');
    fetchRestaurants();
  }, [userRole, navigate]);

  const fetchRestaurants = async () => {
    try {
      const { data: restaurantsData, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRestaurants(restaurantsData || []);
    } catch (error) { 
      console.error(error); 
    }
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
      // Create restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .insert([{
          name: formData.name,
          tagline: formData.tagline || '',
          color: formData.color,
          logo: '',
          is_active: true,
          created_at: new Date()
        }])
        .select()
        .single();

      if (restaurantError) throw restaurantError;

      // Create user with username and password
      await supabase
        .from('users')
        .insert([{
          username: formData.username,
          password: formData.password,
          email: `${formData.username}@qrmenu.local`,
          restaurant_id: restaurantData.id,
          role: 'owner',
          status: 'approved',
          created_at: new Date()
        }]);

      await fetchRestaurants();
      setFormData({ name: '', username: '', password: '', tagline: '', color: '#667eea' });
      setShowForm(false);
      setMessage('✅ Restaurant created successfully!');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) { 
      setMessage('Error: ' + error.message); 
    }
    setLoading(false);
  };

  const toggleActive = async (restaurantId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: !currentStatus })
        .eq('id', restaurantId);
      
      if (error) throw error;
      setRestaurants(restaurants.map(r => 
        r.id === restaurantId ? { ...r, is_active: !currentStatus } : r
      ));
    } catch (error) { 
      alert('Error: ' + error.message); 
    }
  };

  const deleteRestaurant = async (restaurantId) => {
    if (window.confirm('Delete this restaurant and all data?')) {
      try {
        await supabase.from('menu_items').delete().eq('restaurant_id', restaurantId);
        await supabase.from('categories').delete().eq('restaurant_id', restaurantId);
        await supabase.from('users').delete().eq('restaurant_id', restaurantId);
        await supabase.from('restaurants').delete().eq('id', restaurantId);
        setRestaurants(restaurants.filter(r => r.id !== restaurantId));
      } catch (error) { 
        alert('Error: ' + error.message); 
      }
    }
  };

  if (userRole !== 'admin') return <div>Loading...</div>;

  return (
    <div className="admin-panel">
      <nav className="admin-nav">
        <div className="nav-brand"><h2>Admin Panel</h2></div>
        <div className="nav-links">
          <LangSwitcher />
          <Link to="/admin/approvals" className="nav-link">View Requests</Link>
          <button className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="admin-content">
        <div className="admin-header">
          <h1>Restaurant Management</h1>
          <button onClick={() => setShowForm(true)} className="add-btn">+ Create New Restaurant</button>
        </div>

        {message && <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>{message}</div>}

        {showForm && (
          <div className="modal">
            <div className="modal-content">
              <h2>Create New Restaurant</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Restaurant Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label>Owner Username *</label>
                  <input type="text" name="username" value={formData.username} onChange={handleInputChange} required placeholder="e.g., pizzamaster" />
                </div>

                <div className="form-group">
                  <label>Owner Password *</label>
                  <input type="password" name="password" value={formData.password} onChange={handleInputChange} required minLength="6" placeholder="Min 6 characters" />
                </div>

                <div className="form-group">
                  <label>Tagline</label>
                  <input type="text" name="tagline" value={formData.tagline} onChange={handleInputChange} />
                </div>

                <div className="form-group">
                  <label>Theme Color</label>
                  <div className="color-picker-wrapper">
                    <input type="color" name="color" value={formData.color} onChange={handleInputChange} className="color-picker" />
                    <span className="color-value">{formData.color}</span>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => setShowForm(false)} className="cancel-btn">Cancel</button>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="restaurants-table">
          <table>
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Status</th>
                <th>Actions</th>
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
                  <td>
                    <button className={`status-btn ${restaurant.is_active ? 'active' : 'inactive'}`} 
                      onClick={() => toggleActive(restaurant.id, restaurant.is_active)}>
                      {restaurant.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <Link to={`/admin/restaurant/${restaurant.id}`} className="edit-restaurant-btn">Edit Menu</Link>
                      <button onClick={() => deleteRestaurant(restaurant.id)} className="delete-btn">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {restaurants.length === 0 && !showForm && (
          <div className="empty-state">
            <p>No restaurants yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
