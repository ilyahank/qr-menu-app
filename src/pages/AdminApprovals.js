import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './AdminApprovals.css';

export default function AdminApprovals() {
  const { userRole, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (userRole !== 'admin') navigate('/dashboard');
    fetchRequests();
  }, [userRole, navigate]);

  const fetchRequests = async () => {
    try {
      const { data } = await supabase
        .from('subscription_requests')
        .select('*')
        .order('created_at', { ascending: false });
      setRequests(data || []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const approveRequest = async (request) => {
    if (!window.confirm(`Approve ${request.restaurant_name}?`)) return;

    try {
      // Get user
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', request.email)
        .single();

      if (!userData) throw new Error('User not found');

      // Create restaurant
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .insert([{
          name: request.restaurant_name,
          is_active: true,
          created_at: new Date()
        }])
        .select()
        .single();

      if (restError) throw restError;

      // Update user
      await supabase
        .from('users')
        .update({ status: 'approved', restaurant_id: restaurant.id })
        .eq('id', userData.id);

      // Update request
      await supabase
        .from('subscription_requests')
        .update({ status: 'approved', approved_at: new Date(), admin_notes: adminNotes })
        .eq('id', request.id);

      alert('✅ Approved!');
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const rejectRequest = async (request) => {
    if (!window.confirm(`Reject ${request.restaurant_name}?`)) return;

    try {
      await supabase
        .from('subscription_requests')
        .update({ status: 'rejected', admin_notes: adminNotes })
        .eq('id', request.id);

      alert('Request rejected.');
      setSelectedRequest(null);
      setAdminNotes('');
      fetchRequests();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (userRole !== 'admin') return <div>Loading...</div>;

  return (
    <div className="admin-approvals">
      <nav className="admin-nav">
        <div className="nav-brand"><h2>Admin - Approvals</h2></div>
        <div className="nav-links">
          <Link to="/admin" className="nav-link">Restaurants</Link>
          <LangSwitcher />
          <button onClick={signOut} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="approvals-content">
        <h1>Signup Requests</h1>

        <div className="requests-table">
          <table>
            <thead>
              <tr>
                <th>Restaurant</th>
                <th>Email</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(request => (
                <tr key={request.id}>
                  <td>{request.restaurant_name}</td>
                  <td>{request.email}</td>
                  <td><span className={`status ${request.status}`}>{request.status}</span></td>
                  <td>{new Date(request.created_at).toLocaleDateString()}</td>
                  <td>
                    {request.status === 'pending' && (
                      <button onClick={() => setSelectedRequest(request)} className="review-btn">
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedRequest && (
          <div className="modal">
            <div className="modal-content">
              <h2>Review Request</h2>
              <div className="request-details">
                <p><strong>Restaurant:</strong> {selectedRequest.restaurant_name}</p>
                <p><strong>Email:</strong> {selectedRequest.email}</p>
              </div>

              <div className="form-group">
                <label>Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows="4"
                  placeholder="Add notes (optional)"
                />
              </div>

              <div className="modal-actions">
                <button onClick={() => setSelectedRequest(null)} className="cancel-btn">Cancel</button>
                <button onClick={() => rejectRequest(selectedRequest)} className="reject-btn">Reject</button>
                <button onClick={() => approveRequest(selectedRequest)} className="approve-btn">Approve</button>
              </div>
            </div>
          </div>
        )}

        {requests.length === 0 && <p className="empty">No requests.</p>}
      </div>
    </div>
  );
}
