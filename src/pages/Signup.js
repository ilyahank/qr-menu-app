import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import './Signup.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // 1. Create subscription request (not user yet)
      const { error: insertError } = await supabase
        .from('subscription_requests')
        .insert([
          {
            email: email,
            restaurant_name: restaurantName,
            password_hash: password, // In production, hash this!
            status: 'pending'
          }
        ]);

      if (insertError) {
        if (insertError.message.includes('duplicate')) {
          setError('Email already registered. Try logging in.');
        } else {
          setError(insertError.message);
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="signup-container">
        <div className="signup-card success-card">
          <h2>✅ Signup Successful!</h2>
          <p>Your request has been sent to our admin.</p>
          <p>We will review and approve your restaurant within 24 hours.</p>
          <p>You'll receive an email when approved.</p>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h1>QR Menu</h1>
        <h2>Restaurant Signup</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Restaurant Name *</label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>

          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? 'Submitting...' : 'Request Access'}
          </button>
        </form>

        <p className="login-link">
          Already have access? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}
