import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './PendingApproval.css';

export default function PendingApproval() {
  const { signOut } = useAuth();

  return (
    <div className="pending-container">
      <div className="pending-card">
        <h1>⏳ Pending Approval</h1>
        <p>Thank you for signing up!</p>
        <p>Your restaurant signup request is under review.</p>
        <p>Our team will review your request within 24 hours.</p>
        <p>You'll receive an email notification once approved.</p>
        
        <div className="status-info">
          <div className="check-icon">✓</div>
          <p>Your request has been received</p>
        </div>

        <button onClick={signOut} className="logout-btn">
          Logout
        </button>
      </div>
    </div>
  );
}
