import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as localApi from '../localApi';
import './PublicMenu.css';
import { useLanguage } from '../contexts/LanguageContext';

// generateUUID() only works in secure contexts (HTTPS or localhost).
// Since customers open this over plain http://<local-ip>:3000, we need a
// fallback UUID generator that works everywhere.
function generateUUID() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.generateUUID();
  }
  // RFC4122-ish fallback using Math.random (good enough for a local session id)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Offline in-restaurant menu — served from the LOCAL server (localhost:3001).
// No internet required: menu comes from the local cache, orders go straight
// to the local SQLite database.
export default function LocalPublicMenu() {
  const [searchParams] = useSearchParams();
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

  // Session (device) id — persisted per browser, used for table locking
  const [sessionId, setSessionId] = useState('');

  // Get table number from URL (?table=5)
  useEffect(() => {
    const tableParam = searchParams.get('table');
    if (tableParam) setTableNumber(tableParam);
  }, [searchParams]);

  // Init local session id
  useEffect(() => {
    const existing = localStorage.getItem('local_session_id');
    if (existing) {
      setSessionId(existing);
    } else {
      const newSession = generateUUID();
      setSessionId(newSession);
      localStorage.setItem('local_session_id', newSession);
    }
  }, []);

  // Load restaurant info + menu from the LOCAL server
  useEffect(() => {
    const fetchLocalMenu = async () => {
      try {
        setLoading(true);

        const info = await localApi.getRestaurantInfo();
        setRestaurant(info || { name: 'Restaurant', color: '#667eea' });

        const { categories: cats, items } = await localApi.getLocalMenu();
        setCategories(cats || []);
        setMenuItems(items || []);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(
          t.dir === 'rtl'
            ? 'تعذر الوصول للسيرفر المحلي. تأكد أنك متصل بنفس شبكة الواي فاي.'
            : 'Could not reach the local server. Make sure you are on the restaurant WiFi.'
        );
        setLoading(false);
      }
    };
    fetchLocalMenu();
  }, [t]);

  // Cart persistence (per browser)
  useEffect(() => {
    const savedCart = localStorage.getItem('local_cart');
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem('local_cart', JSON.stringify(newCart));
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

  const getCartTotal = () => cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const getCartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      alert(t.enterTable);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Check if table is locked by another device
      const isLocked = await localApi.checkTableLocked(tableNumber.trim(), sessionId);
      if (isLocked) {
        setSubmitError(
          t.dir === 'rtl'
            ? 'هذه الطاولة مستخدمة حالياً. يرجى طلب المساعدة من النادل.'
            : 'This table is currently in use. Please ask staff for assistance.'
        );
        setIsSubmitting(false);
        return;
      }

      await localApi.openTableSession(tableNumber.trim(), sessionId);

      await localApi.createOrder({
        table_number: tableNumber.trim(),
        session_id: sessionId,
        notes: orderNotes.trim() || '',
        items: cart.map(item => ({
          item_id: item.id,
          item_name: item.name,
          price: parseFloat(item.price),
          quantity: item.quantity,
        })),
      });

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
      setSubmitError(
        err.message ||
        (t.dir === 'rtl' ? 'فشلت عملية إرسال الطلب. يرجى المحاولة لاحقاً.' : 'Failed to submit order. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(restaurant.email_contact);
    alert('Email copied: ' + restaurant.email_contact);
  };

  const callPhone = () => {
    if (restaurant.phone) {
      window.location.href = `tel:${restaurant.phone}`;
    }
  };

  if (loading) return (
    <div className="public-menu loading">
      <div className="loader"></div>
      <p>Loading menu...</p>
    </div>
  );

  if (error) {
    return (
      <div className="public-menu error-page" style={{ direction: t.dir }}>
        <div className="error-card">
          <div className="error-icon">📡</div>
          <h2>{t.dir === 'rtl' ? 'المنيو غير متوفر' : 'Menu Unavailable'}</h2>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  const isRtl = t.dir === 'rtl';
  const visibleCategories = categories.filter(cat =>
    menuItems.some(item => item.category_id === cat.id)
  );
  const filteredItems = activeCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category_id === activeCategory);

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

      {cart.length > 0 && (
        <div className="floating-cart-bar" onClick={() => setShowCart(true)}>
          <div className="cart-bar-content">
            <span className="cart-badge">{getCartCount()}</span>
            <span>{isRtl ? 'عرض طلباتك' : 'View your order'}</span>
          </div>
          <span className="cart-bar-total">{getCartTotal().toFixed(0)} {t.currency}</span>
        </div>
      )}

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
              <a href={restaurant.facebook} target="_blank" rel="noreferrer" className="social-btn facebook" aria-label="Facebook">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z"/></svg>
              </a>
            )}
            {restaurant.instagram && (
              <a href={restaurant.instagram} target="_blank" rel="noreferrer" className="social-btn instagram" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 01-1.15 1.77 4.9 4.9 0 01-1.77 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 01-1.77-1.15 4.9 4.9 0 01-1.15-1.77c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.22 1.15-1.77A4.9 4.9 0 015.45 2.53c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 1.8c-2.67 0-2.99.01-4.04.06-.87.04-1.34.18-1.65.3-.42.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.65C4.28 8.68 4.27 9 4.27 12s.01 3.32.06 4.37c.04.87.18 1.34.3 1.65.16.42.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.65.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.37s-.01-3.32-.06-4.37c-.04-.87-.18-1.34-.3-1.65-.16-.42-.35-.71-.66-1.02a2.73 2.73 0 00-1.02-.66c-.31-.12-.78-.26-1.65-.3C14.99 3.81 14.67 3.8 12 3.8zm0 3.05a5.15 5.15 0 110 10.3 5.15 5.15 0 010-10.3zm0 1.8a3.35 3.35 0 100 6.7 3.35 3.35 0 000-6.7zm5.35-1.98a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"/></svg>
              </a>
            )}
            {restaurant.phone && (
              <button onClick={callPhone} className="social-btn phone" aria-label="Call">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>
              </button>
            )}
            {restaurant.email_contact && (
              <button onClick={copyEmail} className="social-btn email" aria-label="Email">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 2v.01L12 12 4 6.01V6h16zM4 18V8l8 6 8-6v10H4z"/></svg>
              </button>
            )}
          </div>
        )}
        <p>{t.poweredBy}</p>
      </footer>
    </div>
  );
}
