import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import { hashPassword } from '../utils/passwordUtils';
import './AdminPanel.css';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
};

export default function AdminPanel() {
  const { userRole, signOut, impersonate, currentUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubStatus, setFilterSubStatus] = useState('all'); // all, active, expiring_soon, expired
  const [sortByDays, setSortByDays] = useState(null); // null, 'asc', 'desc'
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    username: '', 
    password: '', 
    tagline: '', 
    color: '#667eea',
    sub_start_date: new Date().toISOString().split('T')[0],
    sub_duration: '14' // 14, 30, 90, 365, custom
  });
  const [customDays, setCustomDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Subscription Extension Modal State
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedRestForSub, setSelectedRestForSub] = useState(null);
  const [extendDuration, setExtendDuration] = useState('14'); // 14, 30, 90, 365, custom
  const [extendCustomDays, setExtendCustomDays] = useState('');
  const [extendNotes, setExtendNotes] = useState('');

  // Subscription History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyRestName, setHistoryRestName] = useState('');

  // Owner Account Modal State
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [selectedRestForOwner, setSelectedRestForOwner] = useState(null);
  const [ownerForm, setOwnerForm] = useState({ username: '', password: '' });

  useEffect(() => {
    if (userRole && userRole !== 'admin') navigate('/dashboard');
    fetchRestaurants();
  }, [userRole, navigate]);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      // 1. Fetch all restaurants
      const { data: restaurantsData, error: restError } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (restError) throw restError;

      // 2. Fetch all users who are owners
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, restaurant_id, username, email, role');
      
      if (usersError) throw usersError;

      // 3. Fetch all subscriptions
      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');
      
      if (subsError) throw subsError;

      // 4. Map users and subscriptions to restaurants in memory
      const mappedRestaurants = (restaurantsData || []).map(r => {
        const matchingUsers = (usersData || []).filter(u => u.restaurant_id === r.id);
        const sub = (subsData || []).find(s => s.restaurant_id === r.id);

        let daysLeft = null;
        let subStatus = 'none';
        
        if (sub) {
          const end = new Date(sub.end_date);
          const today = new Date();
          // Reset time part to accurately calculate remaining days
          end.setHours(23, 59, 59, 999);
          today.setHours(0, 0, 0, 0);
          const diffTime = end - today;
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          subStatus = daysLeft <= 0 ? 'expired' : (daysLeft <= 7 ? 'expiring_soon' : 'active');
        } else {
          // Default to expired/none if no record exists
          daysLeft = 0;
          subStatus = 'expired';
        }

        return {
          ...r,
          users: matchingUsers,
          subscription: sub,
          daysLeft,
          subStatus
        };
      });

      setRestaurants(mappedRestaurants);
    } catch (error) { 
      console.error('Error fetching restaurants:', error); 
    } finally {
      setLoading(false);
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

      // Check if username already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('username', normalizedUsername);

      if (existingUser && existingUser.length > 0) {
        setMessage('❌ Error: Username already exists! Choose a different one.');
        setLoading(false);
        return;
      }

      // Calculate subscription duration
      let durationDays = parseInt(formData.sub_duration);
      if (formData.sub_duration === 'custom') {
        durationDays = parseInt(customDays);
        if (isNaN(durationDays) || durationDays <= 0) {
          setMessage('❌ Error: Please enter a valid number of days for custom duration.');
          setLoading(false);
          return;
        }
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

      // Create owner user
      const userId = generateUUID();
      const passwordHash = await hashPassword(formData.password);
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          username: normalizedUsername,
          password_hash: passwordHash,
          password: '', // Don't store plain text
          email: `${normalizedUsername}@qrmenu.local`,
          restaurant_id: restaurantData.id,
          role: 'owner',
          status: 'approved',
          created_at: new Date()
        }]);

      if (userError) throw userError;

      // Calculate end date based on start date and duration days
      const startDateObj = new Date(formData.sub_start_date);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + durationDays);
      endDateObj.setHours(23, 59, 59, 999);

      // Create subscription record
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert([{
          restaurant_id: restaurantData.id,
          start_date: startDateObj,
          end_date: endDateObj,
          status: durationDays > 7 ? 'active' : 'expiring_soon'
        }]);

      if (subError) throw subError;

      // Log subscription in history
      await supabase
        .from('subscription_history')
        .insert([{
          restaurant_id: restaurantData.id,
          extended_by: currentUser?.id || null,
          action_type: 'create',
          old_end_date: null,
          new_end_date: endDateObj,
          duration_days: durationDays,
          notes: 'Initial creation'
        }]);

      // Refresh list immediately
      await fetchRestaurants();
      setFormData({ 
        name: '', 
        username: '', 
        password: '', 
        tagline: '', 
        color: '#667eea',
        sub_start_date: new Date().toISOString().split('T')[0],
        sub_duration: '14'
      });
      setCustomDays('');
      setShowForm(false);
      setMessage('✅ Restaurant created successfully!');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) { 
      setMessage('❌ Error: ' + error.message); 
    } finally {
      setLoading(false);
    }
  };

  const handleExtendSubscription = async (e) => {
    e.preventDefault();
    if (!selectedRestForSub) return;
    setLoading(true);

    try {
      let durationDays = parseInt(extendDuration);
      if (extendDuration === 'custom') {
        durationDays = parseInt(extendCustomDays);
        if (isNaN(durationDays) || durationDays <= 0) {
          alert('Please enter a valid number of days');
          setLoading(false);
          return;
        }
      }

      // Get user session to retrieve the JWT token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No active session found. Please log in again.');
      }

      // Call serverless API to perform the extension securely via service role key (bypassing RLS)
      const response = await fetch('/api/extend-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          restaurant_id: selectedRestForSub.id,
          duration_days: durationDays,
          extend_notes: extendNotes || 'Manual extension'
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to extend subscription');
      }

      alert('✅ Subscription extended successfully!');
      setShowExtendModal(false);
      setSelectedRestForSub(null);
      setExtendDuration('14');
      setExtendCustomDays('');
      setExtendNotes('');
      await fetchRestaurants();
    } catch (error) {
      console.error(error);
      alert('Error extending subscription: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShowHistory = async (restaurant) => {
    try {
      setLoading(true);
      setHistoryRestName(restaurant.name);
      
      const { data, error } = await supabase
        .from('subscription_history')
        .select(`
          id,
          action_type,
          old_end_date,
          new_end_date,
          duration_days,
          notes,
          created_at,
          users (username)
        `)
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistoryList(data || []);
      setShowHistoryModal(true);
    } catch (error) {
      alert('Error fetching history: ' + error.message);
    } finally {
      setLoading(false);
    }
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
    if (window.confirm(t.confirmDelete)) {
      try {
        setLoading(true);
        // Get emails of the users
        const { data: usersToDelete, error: fetchUsersError } = await supabase
          .from('users')
          .select('email')
          .eq('restaurant_id', restaurantId);

        if (fetchUsersError) throw fetchUsersError;
        const emails = usersToDelete?.map(u => u.email).filter(Boolean) || [];

        // Delete menu items
        await supabase.from('menu_items').delete().eq('restaurant_id', restaurantId);
        
        // Delete categories
        await supabase.from('categories').delete().eq('restaurant_id', restaurantId);
        
        // Delete users
        await supabase.from('users').delete().eq('restaurant_id', restaurantId);

        // Delete subscription history & subscription record
        await supabase.from('subscription_history').delete().eq('restaurant_id', restaurantId);
        await supabase.from('subscriptions').delete().eq('restaurant_id', restaurantId);
        await supabase.from('daily_sales_summary').delete().eq('restaurant_id', restaurantId);
        await supabase.from('monthly_totals').delete().eq('restaurant_id', restaurantId);

        // Delete subscription requests matching those emails
        if (emails.length > 0) {
          await supabase.from('subscription_requests').delete().in('email', emails);
        }
        
        // Finally delete restaurant
        const { error: deleteError } = await supabase
          .from('restaurants')
          .delete()
          .eq('id', restaurantId);

        if (deleteError) throw deleteError;

        setRestaurants(prev => prev.filter(r => r.id !== restaurantId));
        alert('✅ Restaurant deleted successfully!');
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
      const { data: ownerData, error } = await supabase
        .from('users')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!ownerData) {
        const restaurantObj = restaurants.find(r => r.id === restaurantId);
        if (window.confirm(`❌ Error: No owner user found. Create one now?`)) {
          handleOpenCreateOwner(restaurantObj);
        }
        return;
      }

      await impersonate(ownerData);
      navigate('/dashboard');
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateOwner = (restaurant) => {
    setSelectedRestForOwner(restaurant);
    setOwnerForm({ username: '', password: '' });
    setShowCreateOwner(true);
  };

  const handleOwnerInputChange = (e) => {
    const { name, value } = e.target;
    setOwnerForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateOwner = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedUsername = ownerForm.username.trim().toLowerCase();

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('username', normalizedUsername);

      if (existingUser && existingUser.length > 0) {
        alert('❌ Error: Username already exists!');
        setLoading(false);
        return;
      }

      const userId = generateUUID();
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          username: normalizedUsername,
          password: ownerForm.password,
          email: `${normalizedUsername}@qrmenu.local`,
          restaurant_id: selectedRestForOwner.id,
          role: 'owner',
          status: 'approved',
          created_at: new Date()
        }]);

      if (userError) throw userError;

      alert('✅ Owner account created successfully!');
      setShowCreateOwner(false);
      await fetchRestaurants();
    } catch (error) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort restaurants
  const filteredRestaurants = restaurants.filter(r => {
    // 1. Text Search
    let matchesSearch = true;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchesName = r.name?.toLowerCase().includes(term);
      const matchesUsername = r.users?.some(u => u.username?.toLowerCase().includes(term));
      const matchesEmail = r.users?.some(u => u.email?.toLowerCase().includes(term));
      matchesSearch = matchesName || matchesUsername || matchesEmail;
    }

    // 2. Subscription Status Filter
    let matchesSubFilter = true;
    if (filterSubStatus !== 'all') {
      matchesSubFilter = r.subStatus === filterSubStatus;
    }

    return matchesSearch && matchesSubFilter;
  });

  // Sort
  if (sortByDays !== null) {
    filteredRestaurants.sort((a, b) => {
      const daysA = a.daysLeft === null ? -9999 : a.daysLeft;
      const daysB = b.daysLeft === null ? -9999 : b.daysLeft;
      if (sortByDays === 'asc') return daysA - daysB;
      return daysB - daysA;
    });
  }

  const toggleSort = () => {
    if (sortByDays === null) setSortByDays('asc');
    else if (sortByDays === 'asc') setSortByDays('desc');
    else setSortByDays(null);
  };

  if (userRole !== 'admin') return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div className="admin-panel" style={{ direction: 'rtl', textAlign: 'right' }}>
      <nav className="admin-nav" style={{ padding: '15px 30px' }}>
        <div className="nav-brand"><h2 style={{ margin: 0 }}>لوحة الإدارة IRM</h2></div>
        <div className="nav-links" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <LangSwitcher />
          <Link to="/admin/approvals" className="nav-link" style={{ color: 'white', textDecoration: 'none', fontWeight: '500' }}>طلبات التسجيل</Link>
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>

      <div className="admin-content">
        <div className="admin-header" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>{t.restaurantManagement}</h1>
            <button onClick={() => setShowForm(true)} className="add-btn">{t.newRestaurant}</button>
          </div>
          
          <div className="admin-filters-bar" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="البحث باسم المطعم أو المالك..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="search-input"
              style={{ flex: '1', minWidth: '250px' }}
            />
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label style={{ fontWeight: '600', color: '#555' }}>فلترة الاشتراك:</label>
              <select 
                value={filterSubStatus} 
                onChange={(e) => setFilterSubStatus(e.target.value)}
                className="search-input"
                style={{ width: '180px', padding: '10px' }}
              >
                <option value="all">كل الاشتراكات</option>
                <option value="active">{t.activeSub}</option>
                <option value="expiring_soon">{t.expiringSoonSub}</option>
                <option value="expired">{t.expiredSub}</option>
              </select>
            </div>

            <button 
              onClick={toggleSort} 
              className="cancel-btn" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: sortByDays ? '#eef2ff' : '#f1f3f5', border: sortByDays ? '1px solid #667eea' : 'none' }}
            >
              <span>ترتيب حسب الأيام المتبقية</span>
              {sortByDays === 'asc' ? '⬆️' : sortByDays === 'desc' ? '⬇️' : '↕️'}
            </button>
          </div>
        </div>

        {message && <div className={`message ${message.includes('Error') || message.includes('❌') ? 'error' : 'success'}`}>{message}</div>}

        {/* CREATE RESTAURANT MODAL */}
        {showForm && (
          <div className="modal">
            <div className="modal-content" style={{ maxWidth: '600px', textAlign: 'right' }}>
              <h2>{t.createNewRestaurant}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>اسم المطعم *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label>اسم مستخدم المالك * (يجب أن يكون فريداً لتسجيل الدخول)</label>
                  <input type="text" name="username" value={formData.username} onChange={handleInputChange} required placeholder="مثال: masterburger" />
                </div>

                <div className="form-group">
                  <label>كلمة مرور الحساب * (6 أحرف كحد أدنى)</label>
                  <input type="password" name="password" value={formData.password} onChange={handleInputChange} required minLength="6" />
                </div>

                <div className="form-group">
                  <label>شعار المطعم / جملة وصفية</label>
                  <input type="text" name="tagline" value={formData.tagline} onChange={handleInputChange} placeholder="مثال: ألذ المأكولات في العاصمة" />
                </div>

                <div className="form-group">
                  <label>لون الثيم للمنيو</label>
                  <div className="color-picker-wrapper">
                    <input type="color" name="color" value={formData.color} onChange={handleInputChange} className="color-picker" />
                    <span className="color-value">{formData.color}</span>
                  </div>
                </div>

                <hr style={{ margin: '20px 0', borderColor: '#eee' }} />
                <h3 style={{ margin: '0 0 15px 0', color: '#4f46e5' }}>تفاصيل الاشتراك الأولي</h3>

                <div className="form-group">
                  <label>تاريخ بدء الاشتراك</label>
                  <input type="date" name="sub_start_date" value={formData.sub_start_date} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label>مدة الاشتراك</label>
                  <select name="sub_duration" value={formData.sub_duration} onChange={handleInputChange} className="search-input" style={{ width: '100%', boxSizing: 'border-box' }}>
                    <option value="14">14 يوم</option>
                    <option value="30">30 يوم (شهر)</option>
                    <option value="90">90 يوم (3 أشهر)</option>
                    <option value="365">365 يوم (سنة كاملة)</option>
                    <option value="custom">فترة مخصصة</option>
                  </select>
                </div>

                {formData.sub_duration === 'custom' && (
                  <div className="form-group">
                    <label>المدة بالأيام *</label>
                    <input 
                      type="number" 
                      value={customDays} 
                      onChange={(e) => setCustomDays(e.target.value)} 
                      min="1" 
                      required 
                      placeholder="أدخل عدد الأيام" 
                    />
                  </div>
                )}

                <div className="form-actions" style={{ justifyContent: 'flex-start', gap: '15px' }}>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'جاري الإنشاء...' : 'إنشاء المطعم وتفعيل الاشتراك'}</button>
                  <button type="button" onClick={() => setShowForm(false)} className="cancel-btn">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EXTEND SUBSCRIPTION MODAL */}
        {showExtendModal && selectedRestForSub && (
          <div className="modal">
            <div className="modal-content" style={{ textAlign: 'right' }}>
              <h2>تمديد الاشتراك لـ: {selectedRestForSub.name}</h2>
              <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>
                تاريخ انتهاء الاشتراك الحالي: <strong>{selectedRestForSub.subscription ? new Date(selectedRestForSub.subscription.end_date).toLocaleDateString('ar-DZ') : 'غير محدد'}</strong>
                <br />
                (ملاحظة: إذا كان الاشتراك غير منتهٍ، سيتم إضافة الأيام فوق تاريخ الانتهاء الحالي. وإذا كان منتهياً، فسيتم تمديده بدءاً من تاريخ اليوم).
              </p>
              
              <form onSubmit={handleExtendSubscription}>
                <div className="form-group">
                  <label>فترة التمديد</label>
                  <select 
                    value={extendDuration} 
                    onChange={(e) => setExtendDuration(e.target.value)} 
                    className="search-input" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="14">14 يوم</option>
                    <option value="30">30 يوم (شهر)</option>
                    <option value="90">90 يوم (3 أشهر)</option>
                    <option value="365">365 يوم (سنة)</option>
                    <option value="custom">فترة مخصصة باليوم</option>
                  </select>
                </div>

                {extendDuration === 'custom' && (
                  <div className="form-group">
                    <label>عدد الأيام المطلوب إضافتها *</label>
                    <input 
                      type="number" 
                      value={extendCustomDays} 
                      onChange={(e) => setExtendCustomDays(e.target.value)} 
                      min="1" 
                      required 
                      placeholder="عدد الأيام" 
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>ملاحظات (طريقة الدفع، إلخ)</label>
                  <input 
                    type="text" 
                    value={extendNotes} 
                    onChange={(e) => setExtendNotes(e.target.value)} 
                    placeholder="مثال: دفع نقدي كاش، تحويل CCP" 
                  />
                </div>

                <div className="form-actions" style={{ justifyContent: 'flex-start', gap: '12px' }}>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'جاري التمديد...' : 'تأكيد التمديد'}</button>
                  <button type="button" onClick={() => { setShowExtendModal(false); setSelectedRestForSub(null); }} className="cancel-btn">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUBSCRIPTION HISTORY MODAL */}
        {showHistoryModal && (
          <div className="modal">
            <div className="modal-content" style={{ maxWidth: '700px', textAlign: 'right' }}>
              <h2>سجل اشتراكات مطعم: {historyRestName}</h2>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '15px' }}>
                <table style={{ fontSize: '13px' }}>
                  <thead style={{ background: '#f8f9fa' }}>
                    <tr>
                      <th style={{ textAlign: 'right' }}>العملية</th>
                      <th style={{ textAlign: 'right' }}>المدة مضافة</th>
                      <th style={{ textAlign: 'right' }}>تاريخ النهاية الجديد</th>
                      <th style={{ textAlign: 'right' }}>بواسطة</th>
                      <th style={{ textAlign: 'right' }}>ملاحظات</th>
                      <th style={{ textAlign: 'right' }}>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.length > 0 ? (
                      historyList.map(h => (
                        <tr key={h.id}>
                          <td>{h.action_type === 'create' ? 'إنشاء وتفعيل' : 'تمديد يدوي'}</td>
                          <td><strong>+{h.duration_days} يوم</strong></td>
                          <td>{new Date(h.new_end_date).toLocaleDateString('ar-DZ')}</td>
                          <td>{h.users?.username || 'النظام'}</td>
                          <td>{h.notes || '-'}</td>
                          <td>{new Date(h.created_at).toLocaleDateString('ar-DZ')}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>لا توجد عمليات مسجلة بعد.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <button type="button" onClick={() => { setShowHistoryModal(false); setHistoryList([]); }} className="cancel-btn">إغلاق السجل</button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE OWNER MODAL */}
        {showCreateOwner && selectedRestForOwner && (
          <div className="modal">
            <div className="modal-content" style={{ textAlign: 'right' }}>
              <h2>إنشاء حساب مالك لـ: {selectedRestForOwner.name}</h2>
              <form onSubmit={handleCreateOwner}>
                <div className="form-group">
                  <label>اسم المستخدم للمالك *</label>
                  <input 
                    type="text" 
                    name="username" 
                    value={ownerForm.username} 
                    onChange={handleOwnerInputChange} 
                    required 
                    placeholder="مثال: masterpizza" 
                  />
                </div>

                <div className="form-group">
                  <label>كلمة المرور للمالك * (6 أحرف كحد أدنى)</label>
                  <input 
                    type="password" 
                    name="password" 
                    value={ownerForm.password} 
                    onChange={handleOwnerInputChange} 
                    required 
                    minLength="6" 
                  />
                </div>

                <div className="form-actions" style={{ justifyContent: 'flex-start', gap: '12px' }}>
                  <button type="submit" className="submit-btn" disabled={loading}>{loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button>
                  <button type="button" onClick={() => setShowCreateOwner(false)} className="cancel-btn">إلغاء</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* RESTAURANTS TABLE */}
        <div className="restaurants-table" style={{ marginTop: '20px' }}>
          <table>
            <thead style={{ background: '#f8f9fa' }}>
              <tr>
                <th style={{ textAlign: 'right' }}>المطعم والمالك</th>
                <th style={{ textAlign: 'right' }}>حالة التشغيل</th>
                <th style={{ textAlign: 'right' }}>حالة الاشتراك</th>
                <th style={{ textAlign: 'right' }}>الأيام المتبقية</th>
                <th style={{ textAlign: 'right' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.length > 0 ? (
                filteredRestaurants.map(restaurant => (
                  <tr key={restaurant.id}>
                    <td>
                      <div className="restaurant-info" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div className="color-dot" style={{ backgroundColor: restaurant.color || '#667eea', width: '25px', height: '25px', borderRadius: '50%' }} />
                        <div>
                          <div className="restaurant-name" style={{ fontWeight: '600', fontSize: '15px' }}>{restaurant.name}</div>
                          {restaurant.users && restaurant.users.length > 0 ? (
                            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                              👤 {restaurant.users.map(u => u.username || u.email).join(', ')}
                            </div>
                          ) : (
                            <div className="no-owner" style={{ fontSize: '12px', color: '#ff4444', fontStyle: 'italic', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>لا يوجد حساب مالك</span>
                              <button onClick={() => handleOpenCreateOwner(restaurant)} style={{ padding: '1px 6px', fontSize: '10px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إنشاء حساب</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <button className={`status-btn ${restaurant.is_active ? 'active' : 'inactive'}`} 
                        onClick={() => toggleActive(restaurant.id, restaurant.is_active)}>
                        {restaurant.is_active ? t.active : t.inactive}
                      </button>
                    </td>
                    <td>
                      {restaurant.daysLeft !== null ? (
                        restaurant.daysLeft <= 0 ? (
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fee2e2', color: '#ef4444' }}>
                            {t.expiredSub}
                          </span>
                        ) : restaurant.daysLeft <= 7 ? (
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#d97706' }}>
                            {t.expiringSoonSub}
                          </span>
                        ) : (
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#d1fae5', color: '#059669' }}>
                            {t.activeSub}
                          </span>
                        )
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                          بدون اشتراك
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {restaurant.daysLeft !== null ? (
                        restaurant.daysLeft <= 0 ? (
                          <span style={{ color: '#ef4444' }}>منتهي (0 يوم)</span>
                        ) : (
                          <span>{restaurant.daysLeft} يوم</span>
                        )
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                        <button onClick={() => handleImpersonate(restaurant.id)} className="impersonate-btn" style={{ padding: '5px 10px', fontSize: '12px' }} disabled={loading}>
                          لوحة التحكم المالك
                        </button>
                        <button 
                          onClick={() => { setSelectedRestForSub(restaurant); setExtendDuration('14'); setShowExtendModal(true); }}
                          className="submit-btn" 
                          style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#10b981' }}
                        >
                          تمديد الاشتراك
                        </button>
                        <button 
                          onClick={() => handleShowHistory(restaurant)}
                          className="cancel-btn" 
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                        >
                          السجل
                        </button>
                        <Link to={`/admin/restaurant/${restaurant.id}`} className="edit-restaurant-btn" style={{ padding: '5px 10px', fontSize: '12px', margin: 0 }}>تعديل المنيو</Link>
                        <button onClick={() => deleteRestaurant(restaurant.id)} className="delete-btn" style={{ padding: '5px 10px', fontSize: '12px' }}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#999'}}>لا توجد مطاعم مطابقة للبحث.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
