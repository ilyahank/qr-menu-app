import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import LangSwitcher from '../components/LangSwitcher';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { signIn, userRole } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (loggedIn && userRole !== null) {
      if (userRole === 'admin') navigate('/admin');
      else navigate('/dashboard');
    }
  }, [loggedIn, userRole, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try to sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (authError) {
        setError('Email not found or password incorrect');
        setLoading(false);
        return;
      }

      if (authData?.user) {
        // Check if email is confirmed
        if (!authData.user.email_confirmed_at) {
          setError('Please confirm your email first. Check your inbox.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Check user status in database
        const { data: userRecord } = await supabase
          .from('users')
          .select('status')
          .eq('id', authData.user.id)
          .single();

        // If pending, show waiting page
        if (userRecord?.status === 'pending') {
          await supabase.auth.signOut();
          navigate('/waiting-approval', { state: { email: email } });
          setLoading(false);
          return;
        }

        // If approved, continue
        await signIn(email, password);
        setLoggedIn(true);
      }
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-lang"><LangSwitcher /></div>
        <h1>QR Menu</h1>
        <h2>{t.restaurantLogin}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t.email}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t.password}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t.loggingIn : t.loginBtn}
          </button>
        </form>

        <p className="signup-link">
          New restaurant? <Link to="/signup">Request access here</Link>
        </p>
        <p className="forgot-link">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
