import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import MobileDrawer from '../components/MobileDrawer';
import './OrdersManagement.css';

export default function OrdersManagement() {
  const { currentUser, signOut, userRole } = useAuth();
  const { t } = useLanguage();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Print error message
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

    // Fallback: Poll every 10 seconds in case realtime doesn't work
    const pollingInterval = setInterval(() => {
      fetchOrders();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
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

  // Browser Print handler - using new window approach
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

      // 2. Insert or update print_jobs table for double-print protection
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

      // 3. Generate receipt HTML
      const receiptHTML = generateReceiptHTML(order, type);

      // 4. Open new window and print
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.print();

    } catch (error) {
      console.error(error);
      setPrintErrorMsg(t.dir === 'rtl' ? 'فشل الطباعة: ' + error.message : 'Print error: ' + error.message);
      setTimeout(() => setPrintErrorMsg(''), 6000);
    }
  };

  const generateReceiptHTML = (order, type) => {
    const isRtl = t?.dir === 'rtl';
    const date = new Date(order.created_at).toLocaleString('ar-DZ');
    
    if (type === 'customer') {
      // Customer Receipt
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 400px; 
              margin: 0; 
              padding: 20px; 
              direction: ${isRtl ? 'rtl' : 'ltr'};
            }
            .receipt { 
              border: 1px solid #ccc; 
              padding: 20px; 
              background: white; 
            }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .divider { border-top: 1px solid #ccc; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin: 10px 0; }
            .total { font-weight: bold; font-size: 18px; text-align: right; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .barcode { 
              font-family: monospace; 
              font-size: 14px; 
              letter-spacing: 2px;
              border: 1px solid black;
              padding: 5px;
              text-align: center;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>${restaurant?.name || 'Restaurant'}</h1>
              ${restaurant?.tagline ? `<p>${restaurant.tagline}</p>` : ''}
              ${restaurant?.address ? `<p>${restaurant.address}</p>` : ''}
              ${restaurant?.phone ? `<p>${isRtl ? 'هاتف:' : 'Tel:'} ${restaurant.phone}</p>` : ''}
            </div>
            
            <div class="divider"></div>
            
            <p><strong>${isRtl ? 'طاولة:' : 'Table:'}</strong> ${order.table_number}</p>
            <p><strong>${isRtl ? 'التاريخ:' : 'Date:'}</strong> ${date}</p>
            <p><strong>${isRtl ? 'رقم الطلب:' : 'Order ID:'}</strong> ${order.id.slice(0, 12).toUpperCase()}</p>
            
            <div class="divider"></div>
            
            <h3>${isRtl ? 'العناصر:' : 'Items:'}</h3>
            ${order.order_items ? order.order_items.map(item => `
              <div class="item">
                <span>${item.menu_items?.name} x ${item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(0)} ${t?.currency || 'DA'}</span>
              </div>
            `).join('') : '<p>No items</p>'}
            
            ${order.notes ? `
              <div class="divider"></div>
              <p><strong>${isRtl ? 'ملاحظات:' : 'Notes:'}</strong> ${order.notes}</p>
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="item">
              <span>${isRtl ? 'المجموع:' : 'Subtotal:'}</span>
              <span>${order.total_price.toFixed(0)} ${t?.currency || 'DA'}</span>
            </div>
            <div class="item">
              <span>${isRtl ? 'الضريبة (0%):' : 'Tax (0%):'}</span>
              <span>0 ${t?.currency || 'DA'}</span>
            </div>
            <div class="total" style="margin-top: 10px;">
              <span>${isRtl ? 'الإجمالي:' : 'TOTAL:'} ${order.total_price.toFixed(0)} ${t?.currency || 'DA'}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="footer">
              <p>${isRtl ? 'شكراً لزيارتكم' : 'Thank you for your visit!'}</p>
              <p>${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="barcode">
              ${order.id.slice(0, 12).toUpperCase()}
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Kitchen Receipt
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 400px; 
              margin: 0; 
              padding: 20px; 
              direction: ${isRtl ? 'rtl' : 'ltr'};
            }
            .receipt { 
              border: 3px solid black; 
              padding: 20px; 
              background: white; 
            }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { 
              margin: 0; 
              font-size: 32px; 
              font-weight: bold; 
              border: 4px solid black; 
              padding: 10px 20px;
            }
            .divider { border-top: 2px dashed #000; margin: 10px 0; }
            .item { 
              display: flex; 
              justify-content: space-between; 
              margin: 15px 0; 
              font-size: 18px;
              font-weight: bold;
            }
            .quantity { 
              font-size: 24px; 
              border: 3px solid black; 
              padding: 4px 12px; 
              min-width: 50px; 
              text-align: center;
            }
            .notes { 
              border: 3px solid black; 
              padding: 15px; 
              text-align: center; 
              margin: 20px 0;
              font-size: 18px;
              font-weight: bold;
            }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>${isRtl ? 'طاولة' : 'TABLE'} ${order.table_number}</h1>
              <h2>${isRtl ? 'طلب المطبخ' : 'KITCHEN ORDER'}</h2>
              <p>${new Date(order.created_at).toLocaleTimeString('ar-DZ')}</p>
            </div>
            
            <div class="divider"></div>
            
            ${order.order_items ? order.order_items.map(item => `
              <div class="item">
                <span style="flex: 1;">${item.menu_items?.name}</span>
                <span class="quantity">x${item.quantity}</span>
              </div>
            `).join('') : '<p>No items</p>'}
            
            ${order.notes ? `
              <div class="notes">
                <strong>${isRtl ? 'ملاحظات المطبخ' : 'KITCHEN NOTES'}</strong>
                <p>${order.notes}</p>
              </div>
            ` : ''}
            
            <div class="divider"></div>
            
            <div class="footer">
              <p><strong>${isRtl ? 'عدد العناصر:' : 'Total Items:'}</strong> ${order.order_items?.length || 0}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

  const isRtl = t.dir === 'rtl';

  return (
    <div className="dashboard-container" style={{ direction: t.dir }}>
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <button className="mobile-menu-btn" onClick={() => setMobileDrawerOpen(true)}>☰</button>
          <h2>IRM</h2>
        </div>
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

      <MobileDrawer 
        isOpen={mobileDrawerOpen} 
        onClose={() => setMobileDrawerOpen(false)} 
        onLogout={signOut}
        userRole={userRole}
      />

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
    </div>
  );
}
