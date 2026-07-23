import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import MobileDrawer from '../components/MobileDrawer';
import './CategoriesManagement.css';

const ICONS = ['🍔','🍕','🍣','🍜','🍗','🥗','🥩','🌮','🍱','🥪','🍲','🫕','🍹','🥤','☕','🧃','🍺','🧋','🍰','🍦','🍩','🍪','🎂','🧁'];

export default function CategoriesManagement() {
  const { currentUser, signOut, userRole } = useAuth();
  const { t } = useLanguage();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [restaurantId, setRestaurantId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('🍽️');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase.from('users').select('restaurant_id').eq('id', currentUser.id).single();
        setRestaurantId(userData.restaurant_id);
        const { data } = await supabase.from('categories').select('*').eq('restaurant_id', userData.restaurant_id).order('name');
        setCategories(data || []);
      } catch (error) { console.error(error); }
    };
    fetchData();
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const categoryData = { name: categoryName, icon: categoryIcon, restaurant_id: restaurantId };
      if (editingCategory) {
        await supabase.from('categories').update(categoryData).eq('id', editingCategory.id);
      } else {
        await supabase.from('categories').insert([categoryData]);
      }
      const { data } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('name');
      setCategories(data || []);
      setShowForm(false); setEditingCategory(null); setCategoryName(''); setCategoryIcon('🍽️');
    } catch (error) { alert('Error: ' + error.message); }
    setLoading(false);
  };

  const handleEdit = (category) => {
    setEditingCategory(category); setCategoryName(category.name); setCategoryIcon(category.icon || '🍽️'); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t.confirmDelete)) {
      await supabase.from('categories').delete().eq('id', id);
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  return (
    <div className="categories-management">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <button className="mobile-menu-btn" onClick={() => setMobileDrawerOpen(true)}>☰</button>
          <h2>QR Menu</h2>
        </div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link active">{t.categories}</Link>
          <Link to="/dashboard/tables" className="nav-link">{t.dir === 'rtl' ? 'الطاولات' : 'Tables'}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
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
      <div className="categories-content">
        <div className="categories-header">
          <h1>{t.categoriesTitle}</h1>
          <button onClick={() => setShowForm(true)} className="add-btn">{t.addCategory}</button>
        </div>
        {showForm && (
          <div className="modal">
            <div className="modal-content">
              <h2>{editingCategory ? t.editCategory : t.addNewCategory}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>{t.categoryName} *</label>
                  <input type="text" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>{t.pickIcon}</label>
                  <div className="icon-grid">
                    {ICONS.map(icon => (
                      <button key={icon} type="button" className={`icon-btn ${categoryIcon === icon ? 'selected' : ''}`} onClick={() => setCategoryIcon(icon)}>{icon}</button>
                    ))}
                  </div>
                  <p className="selected-icon">{t.selected}: {categoryIcon}</p>
                </div>
                <div className="form-actions">
                  <button type="button" onClick={() => { setShowForm(false); setEditingCategory(null); setCategoryName(''); setCategoryIcon('🍽️'); }} className="cancel-btn">{t.cancel}</button>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? t.saving : (editingCategory ? t.update : t.add)}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="categories-grid">
          {categories.map(category => (
            <div key={category.id} className="category-card">
              <div className="category-info">
                <span className="category-icon-display">{category.icon || '🍽️'}</span>
                <h3>{category.name}</h3>
              </div>
              <div className="category-actions">
                <button onClick={() => handleEdit(category)} className="edit-btn">{t.edit}</button>
                <button onClick={() => handleDelete(category.id)} className="delete-btn">{t.delete}</button>
              </div>
            </div>
          ))}
        </div>
        {categories.length === 0 && !showForm && <div className="empty-state"><p>{t.noCategoriesYet}</p></div>}
      </div>
    </div>
  );
}
