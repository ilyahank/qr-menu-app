import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import LangSwitcher from '../components/LangSwitcher';
import './AdminRestaurantEditor.css';

export default function AdminRestaurantEditor() {
  const { userRole, signOut } = useAuth();
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    category_id: '',
    image: null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userRole !== 'admin') navigate('/dashboard');
    const load = async () => {
      try {
        const { data: restData } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single();
        setRestaurant(restData);
        const { data: catData } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('name');
        setCategories(catData || []);
        const { data: menuData } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name');
        setMenuItems(menuData || []);
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, [userRole, restaurantId, navigate]);



  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, image: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = editingItem?.image || '';
      if (formData.image) {
        const fileExt = formData.image.name.split('.').pop();
        const filePath = `menu/${restaurantId}/${Date.now()}.${fileExt}`;
        await supabase.storage.from('menu-images').upload(filePath, formData.image);
        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(filePath);
        imageUrl = publicUrl;
      }

      const menuData = {
        name: formData.name,
        price: parseFloat(formData.price),
        description: formData.description || '',
        category_id: formData.category_id,
        restaurant_id: restaurantId,
        image: imageUrl,
        created_at: new Date()
      };

      if (editingItem) {
        await supabase.from('menu_items').update(menuData).eq('id', editingItem.id);
      } else {
        await supabase.from('menu_items').insert([menuData]);
      }

      window.location.reload();
      setShowForm(false);
      setEditingItem(null);
      setFormData({ name: '', price: '', description: '', category_id: '', image: null });
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      description: item.description || '',
      category_id: item.category_id,
      image: null
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Delete this item?')) {
      await supabase.from('menu_items').delete().eq('id', itemId);
      setMenuItems(menuItems.filter(item => item.id !== itemId));
    }
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '';
  const getCategoryIcon = (id) => categories.find(c => c.id === id)?.icon || '';

  if (userRole !== 'admin') return <div>Loading...</div>;
  if (!restaurant) return <div>Loading restaurant...</div>;

  return (
    <div className="admin-editor">
      <nav className="admin-nav">
        <div className="nav-brand"><h2>Admin - Editing: {restaurant.name}</h2></div>
        <div className="nav-links">
          <Link to="/admin" className="nav-link">Back to Restaurants</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="editor-content">
        <div className="editor-header">
          <h1>Menu Items for {restaurant.name}</h1>
          <button onClick={() => setShowForm(true)} className="add-btn">+ Add Item</button>
        </div>

        {showForm && (
          <div className="modal">
            <div className="modal-content">
              <h2>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Price ($) *</label>
                  <input type="number" name="price" step="0.01" value={formData.price} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select name="category_id" value={formData.category_id} onChange={handleInputChange} required>
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Image *</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} required={!editingItem} />
                  {editingItem?.image && !formData.image && (
                    <div className="current-image"><p>Current image uploaded</p></div>
                  )}
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); setFormData({ name: '', price: '', description: '', category_id: '', image: null }); }} className="cancel-btn">Cancel</button>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'Saving...' : (editingItem ? 'Update' : 'Add')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="menu-grid">
          {menuItems.map(item => (
            <div key={item.id} className="menu-item-card">
              {item.image && <img src={item.image} alt={item.name} className="menu-item-image" />}
              <div className="menu-item-info">
                <h3>{item.name}</h3>
                <p className="item-category">{getCategoryIcon(item.category_id)} {getCategoryName(item.category_id)}</p>
                <p className="item-description">{item.description}</p>
                <div className="item-price">${parseFloat(item.price).toFixed(2)}</div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(item)} className="edit-btn">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="delete-btn">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {menuItems.length === 0 && (
          <div className="empty-state">
            <p>No menu items yet. Click "Add Item" to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
