import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import './WaitingApproval.css';

export default function WaitingApproval() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (!email) {
      navigate('/login');
      return;
    }

    // Check approval status every 5 seconds
    const checkApproval = async () => {
      try {
        const { data } = await supabase
          .from('subscription_requests')
          .select('status')
          .eq('email', email)
          .single();

        if (data?.status === 'approved') {
          setStatus('approved');
          setTimeout(() => navigate('/login'), 2000);
        } else if (data?.status === 'rejected') {
          setStatus('rejected');
        }
      } catch (error) {
        console.error(error);
      }
    };

    const interval = setInterval(checkApproval, 5000);
    return () => clearInterval(interval);
  }, [email, navigate]);

  if (status === 'approved') {
    return (
      <div className="waiting-container">
        <div className="waiting-card success">
          <h1>✅ Approved!</h1>
          <p>Your restaurant has been approved!</p>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="waiting-container">
        <div className="waiting-card rejected">
          <h1>❌ Request Rejected</h1>
          <p>Your signup request was not approved.</p>
          <p>Please contact support for more information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-container">
      <div className="waiting-card pending">
        <h1>⏳ Waiting for Approval</h1>
        <p>Thank you for signing up!</p>
        <p className="email-info">Email: <strong>{email}</strong></p>
        <p>Your restaurant signup is under review.</p>
        <p>Our admin team will approve within 24 hours.</p>
        
        <div className="loader"></div>
        
        <p className="auto-check">Checking automatically every 5 seconds...</p>
      </div>
    </div>
  );
}
