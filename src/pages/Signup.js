import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import LangSwitcher from '../components/LangSwitcher';
import './Signup.css';

export default function Signup() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
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
      // 1. Sign up in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // 2. Create subscription request (pending approval)
      if (authData?.user?.id) {
        await supabase.from('subscription_requests').insert([{
          email: email,
          restaurant_name: restaurantName,
          status: 'pending'
        }]);

        // 3. Create pending user
        await supabase.from('users').insert([{
          id: authData.user.id,
          email: email,
          status: 'pending',
          role: 'owner'
        }]);
      }

      setStep(2);
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  if (step === 2) {
    return (
      <div className="signup-container">
        <div className="signup-card success-card">
          <h2>✅ Check Your Email!</h2>
          <p>We sent a confirmation link to:</p>
          <p className="email-display"><strong>{email}</strong></p>
          <ol>
            <li>Click the confirmation link in your email</li>
            <li>Return to this app and login</li>
            <li>Wait for admin approval (24 hours)</li>
          </ol>
          
          <button onClick={() => navigate('/login')} className="back-btn">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-lang"><LangSwitcher /></div>
        <h1>QR Menu</h1>
        <h2>Restaurant Signup</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSignup}>
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
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="login-link">
          Already have access? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}
