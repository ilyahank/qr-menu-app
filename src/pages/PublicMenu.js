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

  // Cart State
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

        // Check subscription
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('end_date')
          .eq('restaurant_id', restaurantId)
          .single();

        if (subData) {
          const end = new Date(subData.end_date);
          const today = new Date();
          if (end <= today) {
            setError(t.restaurantUnavailable);
            setLoading(false);
            return;
          }
        } else {
          // If no subscription record exists, block by default
          setError(t.restaurantUnavailable);
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

  // Load cart from localStorage on mount (scoped to restaurantId)
  useEffect(() => {
    if (restaurantId) {
      const savedCart = localStorage.getItem(`cart_${restaurantId}`);
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [restaurantId]);

  // Save cart to localStorage
  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem(`cart_${restaurantId}`, JSON.stringify(newCart));
  };

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      saveCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      saveCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, change) => {
    const updated = cart.map(c => {
      if (c.id === itemId) {
        const qty = c.quantity + change;
        return qty > 0 ? { ...c, quantity: qty } : null;
      }
      return c;
    }).filter(Boolean);
    saveCart(updated);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  };

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      alert(t.enterTable);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const totalPrice = getCartTotal();

      // 1. Insert order record
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: restaurantId,
          table_number: tableNumber.trim(),
          status: 'pending',
          total_price: totalPrice,
          notes: orderNotes.trim() || null
        }])
        .select()
        .single();

      if (orderError) {
        // Handle trigger database block (subscription expired)
        if (orderError.message.includes('subscription has expired') || orderError.message.includes('no active subscription')) {
          throw new Error(t.subBannerExpired);
        }
        throw orderError;
      }

      // 2. Insert order items
      const orderItemsToInsert = cart.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: parseFloat(item.price),
        notes: null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Clear cart
      saveCart([]);
      setTableNumber('');
      setOrderNotes('');
      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        setShowCart(false);
      }, 4000);

    } catch (err) {
      console.error(err);
      setSubmitError(err.message || 'فشلت عملية إرسال الطلب. يرجى المحاولة لاحقاً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="public-menu loading">
      <div className="loader"></div>
      <p>Loading menu...</p>
    </div>
  );
  if (error) return <div className="public-menu error"><h1>Oops!</h1><p>{error}</p></div>;
  if (!restaurant) return <div className="public-menu error"><h1>Restaurant Not Found</h1></div>;

  const isRtl = t.dir === 'rtl';

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
    <div className="public-menu" style={{ '--theme-color': restaurant.color || '#667eea', direction: t.dir, textAlign: isRtl ? 'right' : 'left' }}>
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
          <button className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>
            {isRtl ? 'الكل' : 'All'}
          </button>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <span className="item-price">{parseFloat(item.price).toFixed(0)} {t.currency}</span>
                          <button onClick={() => addToCart(item)} className="add-to-cart-btn">
                            + {t.addToCart}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        {filteredItems.length === 0 && <div className="empty-menu"><p>{t.noMenuItems}</p></div>}
      </div>

      {/* FLOATING CART BAR */}
      {cart.length > 0 && (
        <div className="floating-cart-bar" onClick={() => setShowCart(true)}>
          <div className="cart-bar-content">
            <span className="cart-badge">{getCartCount()}</span>
            <span>{isRtl ? 'عرض طلباتك' : 'View your order'}</span>
          </div>
          <span className="cart-bar-total">{getCartTotal().toFixed(0)} {t.currency}</span>
        </div>
      )}

      {/* CART DRAWER / MODAL */}
      {showCart && (
        <div className="cart-modal">
          <div className="cart-modal-overlay" onClick={() => !isSubmitting && setShowCart(false)}></div>
          <div className="cart-modal-content">
            <div className="cart-modal-header">
              <h2>{t.cart}</h2>
              <button className="close-cart-btn" onClick={() => setShowCart(false)} disabled={isSubmitting}>✕</button>
            </div>

            {orderSuccess ? (
              <div className="order-success-message">
                <div className="success-icon">✓</div>
                <h3>{t.orderSubmitted}</h3>
              </div>
            ) : cart.length === 0 ? (
              <div className="cart-empty-message">
                <p>{t.cartEmpty}</p>
              </div>
            ) : (
              <form onSubmit={handleCheckout} className="cart-form">
                <div className="cart-items-list">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item-row">
                      <div className="cart-item-details">
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-price">{(parseFloat(item.price) * item.quantity).toFixed(0)} {t.currency}</div>
                      </div>
                      <div className="cart-item-controls">
                        <button type="button" onClick={() => updateQuantity(item.id, -1)} disabled={isSubmitting}>-</button>
                        <span className="cart-item-qty">{item.quantity}</span>
                        <button type="button" onClick={() => addToCart(item)} disabled={isSubmitting}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="summary-row">
                    <span>{t.total}</span>
                    <span className="summary-total">{getCartTotal().toFixed(0)} {t.currency}</span>
                  </div>
                </div>

                {submitError && <div className="submit-error-banner">{submitError}</div>}

                <div className="cart-inputs">
                  <div className="form-group">
                    <label>{t.tableNumber} *</label>
                    <input 
                      type="text" 
                      value={tableNumber} 
                      onChange={(e) => setTableNumber(e.target.value)} 
                      placeholder={t.tableNumberPlaceholder}
                      required 
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.orderNotes}</label>
                    <textarea 
                      value={orderNotes} 
                      onChange={(e) => setOrderNotes(e.target.value)} 
                      placeholder={isRtl ? 'مثال: بدون بصل، فلفل حار جانبي...' : 'e.g., no onions, extra spicy...'}
                      rows="2"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <button type="submit" className="submit-order-btn" disabled={isSubmitting}>
                  {isSubmitting ? (isRtl ? 'جاري إرسال الطلب...' : 'Sending order...') : t.submitOrder}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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
        <p>{t.poweredBy}</p>
      </footer>
    </div>
  );
}
