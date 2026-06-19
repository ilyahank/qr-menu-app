import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './AdminPanel.css';

export default function AdminPanel() {
  const { userRole, signOut, impersonate } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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
      // 1. Fetch all restaurants
      const { data: restaurantsData, error: restError } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (restError) throw restError;

      // 2. Fetch all users who are owners or associated with restaurants
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('restaurant_id, username, email, role');
      
      if (usersError) throw usersError;

      // 3. Map users to restaurants in memory (client-side join)
      const mappedRestaurants = (restaurantsData || []).map(r => {
        const matchingUsers = (usersData || []).filter(u => u.restaurant_id === r.id);
        return {
          ...r,
          users: matchingUsers
        };
      });

      setRestaurants(mappedRestaurants);
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
      const normalizedUsername = formData.username.trim().toLowerCase();

      // Check if username already exists (case-insensitive)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('username', normalizedUsername);

      if (existingUser && existingUser.length > 0) {
        setMessage('❌ Error: Username already exists! Choose a different one.');
        setLoading(false);
        return;
      }

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

      // Create user with ID
      const userId = crypto.randomUUID ? crypto.randomUUID() : 'user-' + Date.now();
      
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          username: normalizedUsername,
          password: formData.password,
          email: `${normalizedUsername}@qrmenu.local`,
          restaurant_id: restaurantData.id,
          role: 'owner',
          status: 'approved',
          created_at: new Date()
        }]);

      if (userError) throw userError;

      // Refresh list immediately
      await fetchRestaurants();
      setFormData({ name: '', username: '', password: '', tagline: '', color: '#667eea' });
      setShowForm(false);
      setMessage('✅ Restaurant created successfully!');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) { 
      setMessage('❌ Error: ' + error.message); 
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
    if (window.confirm('⚠️ Delete this restaurant and ALL its data? This CANNOT be undone!')) {
      try {
        setLoading(true);
        // Get emails of the users of this restaurant first
        const { data: usersToDelete, error: fetchUsersError } = await supabase
          .from('users')
          .select('email')
          .eq('restaurant_id', restaurantId);

        if (fetchUsersError) throw fetchUsersError;
        const emails = usersToDelete?.map(u => u.email).filter(Boolean) || [];

        // Delete menu items first
        const { error: menuError } = await supabase.from('menu_items').delete().eq('restaurant_id', restaurantId);
        if (menuError) throw new Error('Failed to delete menu items: ' + menuError.message);
        
        // Delete categories
        const { error: catError } = await supabase.from('categories').delete().eq('restaurant_id', restaurantId);
        if (catError) throw new Error('Failed to delete categories: ' + catError.message);
        
        // Delete users
        const { error: userDelError } = await supabase.from('users').delete().eq('restaurant_id', restaurantId);
        if (userDelError) throw new Error('Failed to delete owner users: ' + userDelError.message);

        // Delete subscription requests matching those emails
        if (emails.length > 0) {
          const { error: subError } = await supabase
            .from('subscription_requests')
            .delete()
            .in('email', emails);
          if (subError) throw new Error('Failed to delete subscription requests: ' + subError.message);
        }
        
        // Finally delete restaurant
        const { error: deleteError } = await supabase
          .from('restaurants')
          .delete()
          .eq('id', restaurantId);

        if (deleteError) throw new Error('Failed to delete restaurant: ' + deleteError.message);

        // Update state immediately
        setRestaurants(prev => prev.filter(r => r.id !== restaurantId));
        alert('✅ Restaurant deleted successfully!');
        
        // Refresh to be sure
        setTimeout(() => fetchRestaurants(), 1000);
      } catch (error) { 
        alert('❌ Error: ' + error.message); 
      } finally {
        setLoading(false);
      }
    }
  };

  const handleImpersonate = async (restaurantId) => {
    try {
      setLoading(true);
      // Fetch owner of this restaurant
      const { data: ownerData, error } = await supabase
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!ownerData) {
        alert('❌ Error: No owner user found for this restaurant. Cannot impersonate.');
        return;
      }

      // Impersonate owner
      await impersonate(ownerData);
      navigate('/dashboard');
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchesName = r.name?.toLowerCase().includes(term);
    const matchesUsername = r.users?.some(u => u.username?.toLowerCase().includes(term));
    const matchesEmail = r.users?.some(u => u.email?.toLowerCase().includes(term));
    return matchesName || matchesUsername || matchesEmail;
  });

  if (userRole !== 'admin') return <div>Loading...</div>;

  return (
    <div className="admin-panel">
      <nav className="admin-nav">
        <div className="nav-brand"><h2>Admin Panel</h2></div>
        <div className="nav-links">
          <LangSwitcher />
          <Link to="/admin/approvals" className="nav-link">View Requests</Link>
          <button onClick={signOut} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="admin-content">
        <div className="admin-header">
          <h1>Restaurant Management</h1>
          <div className="admin-controls">
            <input 
              type="text" 
              placeholder="Search by restaurant or username..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="search-input"
            />
            <button onClick={() => setShowForm(true)} className="add-btn">+ Create New Restaurant</button>
          </div>
        </div>

        {message && <div className={`message ${message.includes('Error') || message.includes('❌') ? 'error' : 'success'}`}>{message}</div>}

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
                  <label>Owner Username * (Must be unique)</label>
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
              {filteredRestaurants.length > 0 ? (
                filteredRestaurants.map(restaurant => (
                  <tr key={restaurant.id}>
                    <td>
                      <div className="restaurant-info">
                        <div className="color-dot" style={{ backgroundColor: restaurant.color || '#667eea' }} />
                        <div>
                          <div className="restaurant-name">{restaurant.name}</div>
                          {restaurant.users && restaurant.users.length > 0 ? (
                            <div className="restaurant-owner-info" style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>
                              👤 {restaurant.users.map(u => u.username || u.email).join(', ')}
                            </div>
                          ) : (
                            <div className="restaurant-owner-info no-owner" style={{ fontSize: '13px', color: '#ff4444', fontStyle: 'italic', marginTop: '2px' }}>
                              No Owner Account
                            </div>
                          )}
                          <div className="restaurant-tagline" style={{ marginTop: '2px' }}>{restaurant.tagline}</div>
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
                        <button onClick={() => handleImpersonate(restaurant.id)} className="impersonate-btn" disabled={loading}>
                          Enter Owner View
                        </button>
                        <Link to={`/admin/restaurant/${restaurant.id}`} className="edit-restaurant-btn">Edit Menu</Link>
                        <button onClick={() => deleteRestaurant(restaurant.id)} className="delete-btn">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="3" style={{textAlign: 'center', padding: '20px', color: '#999'}}>No restaurants found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
