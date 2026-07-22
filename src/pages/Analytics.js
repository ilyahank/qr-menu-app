import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import './Analytics.css';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const { currentUser, signOut, userRole } = useAuth();
  const { t } = useLanguage();

  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestId, setSelectedRestId] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  
  // Analytics Data State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, avgValue: 0 });
  const [dailySalesData, setDailySalesData] = useState([]);
  const [yearlySalesData, setYearlySalesData] = useState([]);
  const [topItemsData, setTopItemsData] = useState([]);

  useEffect(() => {
    const initPage = async () => {
      if (!currentUser) return;
      
      try {
        if (userRole === 'admin') {
          // Fetch all restaurants for dropdown
          const { data } = await supabase.from('restaurants').select('id, name');
          setRestaurants(data || []);
          if (data && data.length > 0) {
            setSelectedRestId(data[0].id);
            setRestaurantName(data[0].name);
          }
        } else {
          // Fetch owner's restaurant ID
          const { data: userData } = await supabase
            .from('users')
            .select('restaurant_id, restaurants(name)')
            .eq('id', currentUser.id)
            .single();

          if (userData?.restaurant_id) {
            setSelectedRestId(userData.restaurant_id);
            setRestaurantName(userData.restaurants?.name || '');
          }
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    initPage();
  }, [currentUser, userRole]);

  useEffect(() => {
    if (!selectedRestId) return;
    
    // Update display name when selected id changes (for admin dropdown)
    if (userRole === 'admin' && restaurants.length > 0) {
      const selected = restaurants.find(r => r.id === selectedRestId);
      if (selected) setRestaurantName(selected.name);
    }

    fetchAnalyticsData();
  }, [selectedRestId]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' }); // YYYY-MM-DD
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'Africa/Algiers' });
      
      // 1. Fetch Today's Stats from daily_sales_summary
      const { data: todayStats } = await supabase
        .from('daily_sales_summary')
        .select('*')
        .eq('restaurant_id', selectedRestId)
        .eq('date', todayStr)
        .maybeSingle();

      if (todayStats) {
        setStats({
          todayRevenue: parseFloat(todayStats.total_revenue) || 0,
          todayOrders: todayStats.total_orders || 0,
          avgValue: parseFloat(todayStats.avg_order_value) || 0
        });
      } else {
        setStats({ todayRevenue: 0, todayOrders: 0, avgValue: 0 });
      }

      // 2. Fetch Daily Sales for current month
      const { data: dailySales } = await supabase
        .from('daily_sales_summary')
        .select('date, total_revenue, total_orders')
        .eq('restaurant_id', selectedRestId)
        .gte('date', startOfMonth)
        .order('date', { ascending: true });

      const formattedDaily = (dailySales || []).map(row => {
        // format date string (e.g. 2026-07-22 to 22)
        const day = row.date.split('-')[2];
        return {
          name: day,
          revenue: parseFloat(row.total_revenue) || 0,
          orders: row.total_orders || 0
        };
      });
      setDailySalesData(formattedDaily);

      // 3. Fetch Yearly Performance from monthly_totals
      const currentYear = new Date().getFullYear();
      const { data: yearlyTotals } = await supabase
        .from('monthly_totals')
        .select('month, total_revenue, total_orders')
        .eq('restaurant_id', selectedRestId)
        .eq('year', currentYear)
        .order('month', { ascending: true });

      const monthNamesFr = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jyl", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      const formattedYearly = (yearlyTotals || []).map(row => ({
        name: monthNamesFr[row.month] || String(row.month),
        revenue: parseFloat(row.total_revenue) || 0,
        orders: row.total_orders || 0
      }));
      setYearlySalesData(formattedYearly);

      // 4. Fetch Top Selling Items of the current month from raw orders
      const startOfMonthTime = new Date();
      startOfMonthTime.setDate(1);
      startOfMonthTime.setHours(0,0,0,0);
      
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          menu_items (
            name
          ),
          orders!inner(restaurant_id, status)
        `)
        .eq('orders.restaurant_id', selectedRestId)
        .eq('orders.status', 'completed')
        .gte('created_at', startOfMonthTime.toISOString());

      if (!itemsError && orderItemsData) {
        // Group by item name
        const counts = {};
        orderItemsData.forEach(item => {
          const name = item.menu_items?.name || 'Item';
          counts[name] = (counts[name] || 0) + item.quantity;
        });

        // Convert to array and sort
        const chartData = Object.keys(counts).map(key => ({
          name: key,
          value: counts[key]
        })).sort((a, b) => b.value - a.value).slice(0, 5);

        setTopItemsData(chartData);
      } else {
        setTopItemsData([]);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const isRtl = t.dir === 'rtl';

  return (
    <div className="dashboard-container" style={{ direction: t.dir }}>
      <nav className="dashboard-nav">
        <div className="nav-brand"><h2>QR Menu</h2></div>
        <div className="nav-links">
          {userRole === 'admin' ? (
            <>
              <Link to="/admin" className="nav-link">لوحة الإدارة</Link>
              <Link to="/admin/approvals" className="nav-link">طلبات التسجيل</Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="nav-link">{t.dashboard}</Link>
              <Link to="/dashboard/orders" className="nav-link">{t.orders}</Link>
              <Link to="/dashboard/menu" className="nav-link">{t.menu}</Link>
              <Link to="/dashboard/categories" className="nav-link">{t.categories}</Link>
              <Link to="/dashboard/qr-code" className="nav-link">{t.qrCode}</Link>
              <Link to="/dashboard/settings" className="nav-link">{t.settings}</Link>
            </>
          )}
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">{t.logout}</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1>{t.analytics}</h1>
            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '15px' }}>
              {isRtl ? `إحصائيات مطعم: ${restaurantName}` : `Statistiques de: ${restaurantName}`}
            </p>
          </div>

          {/* Restaurant Selector for Admin Role */}
          {userRole === 'admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontWeight: '600' }}>{t.selectRestaurant || 'المطعم'}:</label>
              <select 
                value={selectedRestId} 
                onChange={(e) => setSelectedRestId(e.target.value)} 
                className="search-input"
                style={{ width: '220px', padding: '10px' }}
              >
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
        </header>

        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <>
            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number" style={{ color: '#10b981' }}>{stats.todayRevenue.toFixed(0)} {t.currency}</div>
                <div className="stat-label">{t.todayRevenue}</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ color: '#4f46e5' }}>{stats.todayOrders}</div>
                <div className="stat-label">{t.todayOrdersCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ color: '#f59e0b' }}>{stats.avgValue.toFixed(0)} {t.currency}</div>
                <div className="stat-label">{t.avgOrderValue}</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-container">
              {/* Daily Sales Chart */}
              <div className="chart-card large">
                <h3>{t.dailySalesChart}</h3>
                {dailySalesData.length > 0 ? (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart data={dailySalesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value} ${t.currency}`, '']} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" name={t.revenueDA} stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="no-data-placeholder"><p>{t.noData}</p></div>
                )}
              </div>

              {/* Top Selling Items (Donut) & Yearly monthly totals */}
              <div className="chart-row-grid">
                
                {/* Donut Chart */}
                <div className="chart-card">
                  <h3>{t.topItemsChart}</h3>
                  {topItemsData.length > 0 ? (
                    <div style={{ width: '100%', height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={topItemsData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {topItemsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      <div className="custom-legend">
                        {topItemsData.map((item, index) => (
                          <div key={item.name} className="legend-item">
                            <span className="legend-dot" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                            <span className="legend-text">{item.name} (x{item.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="no-data-placeholder"><p>{t.noData}</p></div>
                  )}
                </div>

                {/* Yearly Chart (Bar) */}
                <div className="chart-card">
                  <h3>{t.yearlyPerformance}</h3>
                  {yearlySalesData.length > 0 ? (
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={yearlySalesData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`${value} ${t.currency}`, '']} />
                          <Bar dataKey="revenue" name={t.revenueDA} fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="no-data-placeholder"><p>{t.noData}</p></div>
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
