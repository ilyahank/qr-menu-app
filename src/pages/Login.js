import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import LangSwitcher from '../components/LangSwitcher';
import './Login.css';
import { supabase } from '../supabase';

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
      // Check if user is approved
      const { data: userData } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (userData?.user) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('status')
          .eq('id', userData.user.id)
          .single();

        if (userRecord?.status === 'pending') {
          await supabase.auth.signOut();
          setError('Your account is pending approval. Please wait for admin confirmation.');
          setLoading(false);
          return;
        }
      }

      await signIn(email, password);
      setLoggedIn(true);
    } catch (error) {
      setError(t.invalidCredentials);
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
          New restaurant? <a href="/signup">Request access</a>
        </p>
      </div>
    </div>
  );
}
