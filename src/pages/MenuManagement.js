import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './MenuManagement.css';

export default function MenuManagement() {
  const { currentUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', price: '', description: '', category_id: '', image: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase.from('users').select('restaurant_id').eq('id', currentUser.id).single();
        setRestaurantId(userData.restaurant_id);
        const { data: categoriesData } = await supabase.from('categories').select('*').eq('restaurant_id', userData.restaurant_id).order('name');
        setCategories(categoriesData || []);
        const { data: menuData } = await supabase.from('menu_items').select('*').eq('restaurant_id', userData.restaurant_id).order('name');
        setMenuItems(menuData || []);
      } catch (error) { console.error(error); }
    };
    fetchData();
  }, [currentUser]);

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
      const menuData = { name: formData.name, price: parseFloat(formData.price), description: formData.description || '', category_id: formData.category_id, restaurant_id: restaurantId, image: imageUrl, created_at: new Date() };
      if (editingItem) {
        await supabase.from('menu_items').update(menuData).eq('id', editingItem.id);
      } else {
        await supabase.from('menu_items').insert([menuData]);
      }
      const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name');
      setMenuItems(data || []);
      setShowForm(false); setEditingItem(null);
      setFormData({ name: '', price: '', description: '', category_id: '', image: null });
    } catch (error) { alert('Error: ' + error.message); }
    setLoading(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ name: item.name, price: item.price.toString(), description: item.description || '', category_id: item.category_id, image: null });
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm(t.confirmDelete)) {
      await supabase.from('menu_items').delete().eq('id', itemId);
      setMenuItems(menuItems.filter(item => item.id !== itemId));
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '';
  const getCategoryIcon = (id) => categories.find(c => c.id === id)?.icon || '';

  return (
    <div className="menu-management">
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/menu" className="nav-link active">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>
      <div className="menu-content">
        <div className="menu-header">
          <h1>{t.menuItemsTitle}</h1>
          <button onClick={() => setShowForm(true)} className="add-btn">{t.addItem}</button>
        </div>
        <div className="search-bar">
          <input type="text" placeholder={`🔍 ${t.searchByName}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
        </div>
        <div className="category-tabs">
          <button className={`tab-btn ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>
            {t.all} ({menuItems.length})
          </button>
          {categories.map(cat => {
            const count = menuItems.filter(i => i.category_id === cat.id).length;
            return (
              <button key={cat.id} className={`tab-btn ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
                {cat.icon} {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {showForm && (
          <div className="modal">
            <div className="modal-content">
              <h2>{editingItem ? t.editMenuItem : t.addNewMenuItem}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{t.name} *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>{t.price} *</label>
                  <input type="number" name="price" step="0.01" value={formData.price} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>{t.description}</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
                </div>
                <div className="form-group">
                  <label>{t.category} *</label>
                  <select name="category_id" value={formData.category_id} onChange={handleInputChange} required>
                    <option value="">{t.selectCategory}</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t.image} *</label>
                  <input type="file" accept="image/*" onChange={handleFileChange} required={!editingItem} />
                  {editingItem?.image && !formData.image && <div className="current-image"><p>{t.currentImageUploaded}</p></div>}
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); setFormData({ name: '', price: '', description: '', category_id: '', image: null }); }} className="cancel-btn">{t.cancel}</button>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? t.saving : (editingItem ? t.update : t.add)}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="menu-grid">
          {filteredItems.map(item => (
            <div key={item.id} className="menu-item-card">
              {item.image && <img src={item.image} alt={item.name} className="menu-item-image" />}
              <div className="menu-item-info">
                <h3>{item.name}</h3>
                <p className="item-category">{getCategoryIcon(item.category_id)} {getCategoryName(item.category_id)}</p>
                <p className="item-description">{item.description}</p>
                <div className="item-price">${parseFloat(item.price).toFixed(2)}</div>
                <div className="item-actions">
                  <button onClick={() => handleEdit(item)} className="edit-btn">{t.edit}</button>
                  <button onClick={() => handleDelete(item.id)} className="delete-btn">{t.delete}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredItems.length === 0 && (
          <div className="empty-state">
            <p>{searchQuery ? `${t.noItemsFound}: "${searchQuery}"` : t.noItemsFound}</p>
          </div>
        )}
      </div>
    </div>
  );
}
