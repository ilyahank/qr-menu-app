import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import QRCode from 'qrcode.react';
import './TablesManagement.css';

export default function TablesManagement() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const isRtl = t.dir === 'rtl';

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('restaurant_id')
          .eq('id', currentUser.id)
          .single();

        if (userData?.restaurant_id) {
          const { data: restaurantData } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', userData.restaurant_id)
            .single();
          setRestaurant(restaurantData);

          const { data: tablesData } = await supabase
            .from('restaurant_tables')
            .select('*')
            .eq('restaurant_id', userData.restaurant_id)
            .order('table_number');
          setTables(tablesData || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const generateQRUrl = (tableId) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/menu/${restaurant.id}?table=${tableId}`;
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .insert([{
          restaurant_id: restaurant.id,
          table_number: newTableNumber.trim(),
          table_name: newTableName.trim() || null
        }]);

      if (error) throw error;

      // Refresh tables list
      const { data: tablesData } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('table_number');
      setTables(tablesData || []);

      setNewTableNumber('');
      setNewTableName('');
      setShowAddModal(false);
    } catch (error) {
      console.error(error);
      alert(isRtl ? 'فشل إضافة الطاولة' : 'Failed to add table');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!window.confirm(isRtl ? 'هل أنت متأكد من حذف هذه الطاولة؟' : 'Are you sure you want to delete this table?')) return;

    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      setTables(tables.filter(t => t.id !== tableId));
    } catch (error) {
      console.error(error);
      alert(isRtl ? 'فشل حذف الطاولة' : 'Failed to delete table');
    }
  };

  const downloadQR = (tableId, tableNumber) => {
    const canvas = document.getElementById(`qr-${tableId}`);
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `table-${tableNumber}-qr.png`;
    link.href = url;
    link.click();
  };

  if (loading) return <div className="loading">{t.loadingMenu}</div>;

  return (
    <div className="tables-management" style={{ direction: t.dir }}>
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          <a href="/dashboard" className="nav-link">{t.dashboard}</a>
          <a href="/dashboard/orders" className="nav-link">{t.orders}</a>
          <a href="/dashboard/analytics" className="nav-link">{t.analytics}</a>
          <a href="/dashboard/menu" className="nav-link">{t.menu}</a>
          <a href="/dashboard/categories" className="nav-link">{t.categories}</a>
          <a href="/dashboard/tables" className="nav-link active">{isRtl ? 'الطاولات' : 'Tables'}</a>
          <a href="/dashboard/qr-code" className="nav-link">{t.qrCode}</a>
          <a href="/dashboard/settings" className="nav-link">{t.settings}</a>
        </div>
      </nav>

      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1>{isRtl ? 'إدارة الطاولات' : 'Tables Management'}</h1>
          {restaurant && <div className="restaurant-info"><h2>{restaurant.name}</h2></div>}
        </header>

        <div className="tables-header">
          <button onClick={() => setShowAddModal(true)} className="add-table-btn">
            + {isRtl ? 'إضافة طاولة' : 'Add Table'}
          </button>
        </div>

        <div className="tables-grid">
          {tables.length > 0 ? (
            tables.map(table => (
              <div key={table.id} className="table-card">
                <div className="table-info">
                  <h3>{isRtl ? 'طاولة' : 'Table'} {table.table_number}</h3>
                  {table.table_name && <p>{table.table_name}</p>}
                </div>
                <div className="qr-section">
                  <div className="qr-container">
                    <QRCode
                      id={`qr-${table.id}`}
                      value={generateQRUrl(table.id)}
                      size={150}
                      level="H"
                    />
                  </div>
                  <button
                    onClick={() => downloadQR(table.id, table.table_number)}
                    className="download-qr-btn"
                  >
                    {isRtl ? 'تحميل QR' : 'Download QR'}
                  </button>
                </div>
                <button
                  onClick={() => handleDeleteTable(table.id)}
                  className="delete-table-btn"
                >
                  {t.delete}
                </button>
              </div>
            ))
          ) : (
            <div className="no-tables">
              <p>{isRtl ? 'لا توجد طاولات بعد. أضف طاولة للبدء!' : 'No tables yet. Add a table to get started!'}</p>
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="modal-overlay" onClick={() => !isAdding && setShowAddModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>{isRtl ? 'إضافة طاولة جديدة' : 'Add New Table'}</h2>
              <form onSubmit={handleAddTable}>
                <div className="form-group">
                  <label>{isRtl ? 'رقم الطاولة *' : 'Table Number *'}</label>
                  <input
                    type="text"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    required
                    disabled={isAdding}
                  />
                </div>
                <div className="form-group">
                  <label>{isRtl ? 'اسم الطاولة (اختياري)' : 'Table Name (Optional)'}</label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    disabled={isAdding}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="cancel-btn"
                    disabled={isAdding}
                  >
                    {t.cancel}
                  </button>
                  <button type="submit" className="submit-btn" disabled={isAdding}>
                    {isAdding ? t.saving : t.add}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
