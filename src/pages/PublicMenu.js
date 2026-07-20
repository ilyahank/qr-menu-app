import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import './PublicMenu.css';
import { useLanguage } from '../contexts/LanguageContext';

export default function PublicMenu() {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const { t } = useLanguage();

  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        setLoading(true);
        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants').select('*').eq('id', restaurantId).single();
        if (restaurantError) throw restaurantError;
        if (!restaurantData.is_active) {
          setError(t.restaurantClosed);
          setLoading(false);
          return;
        }
        setRestaurant(restaurantData);
        const { data: categoriesData } = await supabase
          .from('categories').select('*').eq('restaurant_id', restaurantId).order('name');
        setCategories(categoriesData || []);
        const { data: menuData } = await supabase
          .from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name');
        setMenuItems(menuData || []);
        setLoading(false);
      } catch (err) {
        setError(t.loadingMenu);
        setLoading(false);
      }
    };
    if (restaurantId) fetchMenuData();
  }, [restaurantId, t]);

  if (loading) return (
    <div className="public-menu loading">
      <div className="loader"></div>
      <p>Loading menu...</p>
    </div>
  );
  if (error) return <div className="public-menu error"><h1>Oops!</h1><p>{error}</p></div>;
  if (!restaurant) return <div className="public-menu error"><h1>Restaurant Not Found</h1></div>;

  const visibleCategories = categories.filter(cat =>
    menuItems.some(item => item.category_id === cat.id)
  );
  const filteredItems = activeCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category_id === activeCategory);

  const copyEmail = () => {
    navigator.clipboard.writeText(restaurant.email_contact);
    alert('Email copied: ' + restaurant.email_contact);
  };

  const callPhone = () => {
    if (restaurant.phone) {
      window.location.href = `tel:${restaurant.phone}`;
    }
  };

  return (
    <div className="public-menu" style={{ '--theme-color': restaurant.color || '#667eea' }}>
      <header className="menu-header">
        <div className="restaurant-logo-circle">
          {restaurant.logo
            ? <img src={restaurant.logo} alt={restaurant.name} />
            : <span>{restaurant.name.charAt(0).toUpperCase()}</span>
          }
        </div>
        <h1 className="restaurant-name">{restaurant.name}</h1>
        {restaurant.tagline && <p className="restaurant-tagline">{restaurant.tagline}</p>}
      </header>

      {visibleCategories.length > 0 && (
        <div className="category-filters">
          <button className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>All</button>
          {visibleCategories.map(cat => (
            <button key={cat.id} className={`filter-btn ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="menu-content">
        {visibleCategories
          .filter(cat => activeCategory === 'all' || cat.id === activeCategory)
          .map(category => {
            const categoryItems = filteredItems.filter(item => item.category_id === category.id);
            if (categoryItems.length === 0) return null;
            return (
              <div key={category.id} className="category-section">
                <h2 className="category-title">{category.icon} {category.name}</h2>
                <div className="items-grid">
                  {categoryItems.map(item => (
                    <div key={item.id} className="menu-item-card">
                      {item.image && <div className="item-image"><img src={item.image} alt={item.name} /></div>}
                      <div className="item-info">
                        <h3 className="item-name">{item.name}</h3>
                        {item.description && <p className="item-description">{item.description}</p>}
                        <span className="item-price">${parseFloat(item.price).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        {filteredItems.length === 0 && <div className="empty-menu"><p>No items available.</p></div>}
      </div>

      <footer className="menu-footer">
        {(restaurant.facebook || restaurant.instagram || restaurant.phone || restaurant.email_contact) && (
          <div className="social-links">
            {restaurant.facebook && (
              <a href={restaurant.facebook} target="_blank" rel="noreferrer" className="social-btn facebook">
                <i className="fab fa-facebook-f"></i>
              </a>
            )}
            {restaurant.instagram && (
              <a href={restaurant.instagram} target="_blank" rel="noreferrer" className="social-btn instagram">
                <i className="fab fa-instagram"></i>
              </a>
            )}
            {restaurant.phone && (
              <button onClick={callPhone} className="social-btn phone" title="Call us">
                <i className="fas fa-phone"></i>
              </button>
            )}
            {restaurant.email_contact && (
              <button onClick={copyEmail} className="social-btn email" title="Copy email">
                <i className="fas fa-envelope"></i>
              </button>
            )}
          </div>
        )}
        <p>Powered by QR Menu</p>
      </footer>
    </div>
  );
}
