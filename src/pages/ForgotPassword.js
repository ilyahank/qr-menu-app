import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import LangSwitcher from '../components/LangSwitcher';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      setStep(2);
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  if (step === 2) {
    return (
      <div className="forgot-container">
        <div className="forgot-card success-card">
          <h2>✅ Email Sent!</h2>
          <p>We sent a password reset link to:</p>
          <p className="email-display"><strong>{email}</strong></p>
          <p>Check your email and click the reset link.</p>
          <p>You'll be able to set a new password.</p>
          
          <button onClick={() => navigate('/login')} className="back-btn">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-container">
      <div className="forgot-card">
        <div className="forgot-lang"><LangSwitcher /></div>
        <h1>QR Menu</h1>
        <h2>Forgot Password?</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleRequestReset}>
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="forgot-btn" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="back-link">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
