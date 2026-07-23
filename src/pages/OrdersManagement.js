import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './OrdersManagement.css';

export default function OrdersManagement() {
  const { currentUser, signOut } = useAuth();
  const { t } = useLanguage();
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Print state for rendering hidden receipt
  const [printData, setPrintData] = useState(null);
  const [printErrorMsg, setPrintErrorMsg] = useState('');

  useEffect(() => {
    const fetchOwnerRestaurant = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('restaurant_id')
          .eq('id', currentUser.id)
          .single();

        if (userData?.restaurant_id) {
          setRestaurantId(userData.restaurant_id);
          const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', userData.restaurant_id)
            .single();
          setRestaurant(restaurantData);
        }
      } catch (error) {
        console.error('Error fetching owner restaurant:', error);
      }
    };
    fetchOwnerRestaurant();
  }, [currentUser]);

  const fetchOrders = async () => {
    if (!restaurantId) return;
    try {
      // Fetch orders and join with order items and menu items
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            notes,
            menu_items (
              name
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;
    
    fetchOrders();

    // Subscribe to Postgres Changes for realtime order updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', orderId);

      if (error) throw error;
      
      // Update in-memory state
      const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      setOrders(updatedOrders);

      // Automatically trigger thermal print receipts
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const orderWithNewStatus = { ...order, status: newStatus };
        if (newStatus === 'confirmed') {
          // Print kitchen copy automatically when order is confirmed
          handlePrint(orderWithNewStatus, 'kitchen');
        } else if (newStatus === 'completed') {
          // Print customer copy automatically when order is completed
          handlePrint(orderWithNewStatus, 'customer');
        }
      }
    } catch (error) {
      setPrintErrorMsg(t.dir === 'rtl' ? 'فشل تحديث حالة الطلب: ' + error.message : 'Error updating order status: ' + error.message);
      setTimeout(() => setPrintErrorMsg(''), 6000);
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm(t.dir === 'rtl' ? 'هل أنت متأكد من حذف هذا الطلب؟' : 'Are you sure you want to delete this order?')) return;

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      
      // Remove from in-memory state
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (error) {
      setPrintErrorMsg(t.dir === 'rtl' ? 'فشل حذف الطلب: ' + error.message : 'Error deleting order: ' + error.message);
      setTimeout(() => setPrintErrorMsg(''), 6000);
    }
  };

  const unlockTable = async (tableNumber) => {
    try {
      const { error } = await supabase.rpc('unlock_table', {
        p_restaurant_id: restaurantId,
        p_table_number: tableNumber
      });

      if (error) throw error;
      
      setPrintErrorMsg(t.dir === 'rtl' ? 'تم فتح الطاولة بنجاح' : 'Table unlocked successfully');
      setTimeout(() => setPrintErrorMsg(''), 3000);
    } catch (error) {
      setPrintErrorMsg(t.dir === 'rtl' ? 'فشل فتح الطاولة: ' + error.message : 'Error unlocking table: ' + error.message);
      setTimeout(() => setPrintErrorMsg(''), 6000);
    }
  };

  // Browser Print handler
  const handlePrint = async (order, type) => {
    try {
      // 1. Check if print job already exists
      const { data: existingJob } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('order_id', order.id)
        .eq('print_type', type)
        .maybeSingle();

      if (existingJob && existingJob.status === 'printed') {
        const confirmReprint = window.confirm(
          t.dir === 'rtl'
            ? 'هذه الفاتورة تمت طباعتها بالفعل. هل تريد إعادة الطباعة؟'
            : 'This receipt was already printed. Do you want to reprint?'
        );
        if (!confirmReprint) return;
      }

      // 2. Prepare receipt payload
      setPrintData({ order, type });

      // 3. Insert or update print_jobs table for double-print protection
      if (existingJob) {
        await supabase
          .from('print_jobs')
          .update({ status: 'printed', attempts: existingJob.attempts + 1, updated_at: new Date() })
          .eq('id', existingJob.id);
      } else {
        await supabase
          .from('print_jobs')
          .insert([{
            restaurant_id: restaurantId,
            order_id: order.id,
            print_type: type,
            status: 'printed',
            attempts: 1
          }]);
      }

      // 4. Trigger browser print dialog (requires tiny timeout for DOM render)
      setTimeout(() => {
        window.print();
        setPrintData(null);
      }, 300);

    } catch (error) {
      console.error(error);
      setPrintErrorMsg(t.printError);
      setTimeout(() => setPrintErrorMsg(''), 6000);
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

  const isRtl = t.dir === 'rtl';

  return (
    <div className="dashboard-container" style={{ direction: t.dir }}>
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
          <Link to="/dashboard/orders" className="nav-link active">{t.orders}</Link>
          <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
          <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
          <Link to="/dashboard/tables" className="nav-link">{t.dir === 'rtl' ? 'الطاولات' : 'Tables'}</Link>
          <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
          <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>

      <div className="dashboard-content">
        {printErrorMsg && (
          <div className="print-error-banner" style={{
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            padding: '12px 20px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <span>⚠️ {printErrorMsg}</span>
            <button onClick={() => setPrintErrorMsg('')} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>×</button>
          </div>
        )}
        <header className="dashboard-header">
          <h1>{t.orders}</h1>
          {restaurant && <div className="restaurant-info"><h2>{restaurant.name}</h2></div>}
        </header>

        <div className="orders-filters">
          <button 
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            {t.dir === 'rtl' ? 'الكل' : 'All'}
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            {t.statusPending}
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('confirmed')}
          >
            {t.statusConfirmed}
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            {t.statusCompleted}
          </button>
        </div>

        <div className="orders-grid">
          {orders.length > 0 ? (
            orders.filter(order => statusFilter === 'all' || order.status === statusFilter).map(order => (
              <div key={order.id} className={`order-card status-${order.status}`}>
                <div className="order-card-header">
                  <span className="table-badge">{t.tableNumber}: {order.table_number}</span>
                  <span className={`order-status-label ${order.status}`}>
                    {order.status === 'pending' && t.statusPending}
                    {order.status === 'confirmed' && t.statusConfirmed}
                    {order.status === 'completed' && t.statusCompleted}
                    {order.status === 'cancelled' && t.statusCancelled}
                  </span>
                </div>
                
                <div className="order-items-summary">
                  {order.order_items && order.order_items.map(item => (
                    <div key={item.id} className="order-item-line">
                      <span>{item.menu_items?.name} <strong>x{item.quantity}</strong></span>
                      <span>{(parseFloat(item.price) * item.quantity).toFixed(0)} {t.currency}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="order-notes-box">
                    <strong>{isRtl ? 'ملاحظات الزبون:' : 'Customer Notes:'}</strong>
                    <p>{order.notes}</p>
                  </div>
                )}

                <div className="order-card-footer">
                  <div className="order-total-price">
                    <span>{t.total}:</span>
                    <strong>{parseFloat(order.total_price).toFixed(0)} {t.currency}</strong>
                  </div>
                  <div className="order-time" style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                    {new Date(order.created_at).toLocaleTimeString('ar-DZ')} - {new Date(order.created_at).toLocaleDateString('ar-DZ')}
                  </div>
                </div>

                <div className="order-actions-bar">
                  {order.status === 'pending' && (
                    <>
                      <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="action-btn confirm-btn">
                        {t.markConfirmed}
                      </button>
                      <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="action-btn cancel-btn">
                        {t.cancelOrder}
                      </button>
                    </>
                  )}
                  {order.status === 'confirmed' && (
                    <>
                      <button onClick={() => updateOrderStatus(order.id, 'completed')} className="action-btn complete-btn">
                        {t.markCompleted}
                      </button>
                      <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="action-btn cancel-btn">
                        {t.cancelOrder}
                      </button>
                    </>
                  )}
                  
                  {/* Delete order button */}
                  <button onClick={() => deleteOrder(order.id)} className="action-btn delete-btn">
                    {t.delete}
                  </button>

                  {/* Unlock table button */}
                  <button onClick={() => unlockTable(order.table_number)} className="action-btn unlock-btn">
                    {t.dir === 'rtl' ? 'فتح الطاولة' : 'Unlock Table'}
                  </button>
                  
                  {/* PRINTING SHORTCUTS */}
                  {(order.status === 'confirmed' || order.status === 'completed') && (
                    <div className="print-shortcuts" style={{ display: 'flex', gap: '5px', width: '100%', marginTop: '10px' }}>
                      <button onClick={() => handlePrint(order, 'customer')} className="print-btn customer">
                        🖨️ {t.printCustomer}
                      </button>
                      <button onClick={() => handlePrint(order, 'kitchen')} className="print-btn kitchen">
                        🍳 {t.printKitchen}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-orders-message">
              <p>{t.noOrders}</p>
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC RECIEPT PRINT CONTAINER (HIDDEN VIA CSS EXCEPT DURING PRINT) */}
      {printData && (
        <div id="thermal-print-section" className={printData.type} style={{ direction: isRtl ? 'rtl' : 'ltr', fontFamily: 'monospace', width: '58mm', fontSize: '12px', padding: '5px', color: '#000', background: '#fff' }}>
          {printData.type === 'customer' ? (
            // Customer Receipt
            <div className="receipt-customer">
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>{restaurant?.name}</h2>
                {restaurant?.tagline && <p style={{ margin: '0', fontSize: '10px' }}>{restaurant.tagline}</p>}
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{'='.repeat(32)}</p>
                <h3 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold' }}>{isRtl ? 'طاولة' : 'Table'}: {printData.order.table_number}</h3>
                <p style={{ margin: '5px 0', fontSize: '10px' }}>{new Date(printData.order.created_at).toLocaleString('ar-DZ')}</p>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{'='.repeat(32)}</p>
              </div>

              <div style={{ margin: '10px 0' }}>
                {printData.order.order_items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                    <span style={{ flex: 1 }}>{item.menu_items?.name}</span>
                    <span style={{ fontWeight: 'bold' }}>x{item.quantity}</span>
                    <span style={{ fontWeight: 'bold' }}>{(parseFloat(item.price) * item.quantity).toFixed(0)} {t.currency}</span>
                  </div>
                ))}
              </div>

              {printData.order.notes && (
                <div style={{ margin: '10px 0', padding: '5px', border: '1px dashed #000', fontSize: '10px' }}>
                  <strong>{isRtl ? 'ملاحظات:' : 'Notes:'}</strong>
                  <p style={{ margin: '4px 0 0 0' }}>{printData.order.notes}</p>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{'='.repeat(32)}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', padding: '0 5px' }}>
                  <span>{isRtl ? 'الإجمالي' : 'TOTAL'}:</span>
                  <span>{parseFloat(printData.order.total_price).toFixed(0)} {t.currency}</span>
                </div>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{'='.repeat(32)}</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', fontWeight: 'bold' }}>{isRtl ? 'شكراً لزيارتكم' : 'Thank you for your visit'}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#666' }}>{restaurant?.phone || ''}</p>
              </div>
            </div>
          ) : (
            // Kitchen Copy (Prices hidden, table number large)
            <div className="receipt-kitchen">
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h1 style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', border: '3px solid black', padding: '8px 15px' }}>
                  {isRtl ? 'طاولة' : 'TABLE'} {printData.order.table_number}
                </h1>
                <h2 style={{ margin: '10px 0 5px 0', fontSize: '16px', fontWeight: 'bold' }}>
                  {isRtl ? 'طلب المطبخ' : 'KITCHEN ORDER'}
                </h2>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{new Date(printData.order.created_at).toLocaleTimeString('ar-DZ')}</p>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{'='.repeat(32)}</p>
              </div>

              <div style={{ margin: '10px 0' }}>
                {printData.order.order_items.map(item => (
                  <div key={item.id} style={{ marginBottom: '12px', fontSize: '14px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.menu_items?.name}</span>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', border: '2px solid black', padding: '2px 10px', minWidth: '40px', textAlign: 'center' }}>
                        x{item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {printData.order.notes && (
                <div style={{ margin: '15px 0', padding: '10px', border: '2px solid black', background: '#fff', textAlign: 'center' }}>
                  <strong style={{ fontSize: '14px', textDecoration: 'underline' }}>
                    {isRtl ? 'ملاحظات المطبخ' : 'KITCHEN NOTES'}
                  </strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>{printData.order.notes}</p>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>{'='.repeat(32)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
