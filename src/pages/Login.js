import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import LangSwitcher from '../components/LangSwitcher';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { userRole } = useAuth();
  useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole) {
      if (userRole === 'admin') navigate('/admin');
      else navigate('/dashboard');
    }
  }, [userRole, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Find user by username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (userError || !userData) {
        setError('Username not found');
        setLoading(false);
        return;
      }

      console.log('Found user:', userData);
      console.log('Entered password:', password);
      console.log('Stored password:', userData.password);

      // Direct password comparison (plain text)
      if (userData.password !== password) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      // Login successful
      console.log('Login successful for:', username);
      
      if (userData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-lang"><LangSwitcher /></div>
        <h1>QR Menu</h1>
        <h2>Restaurant Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>* Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="Enter your username"
            />
          </div>
          <div className="form-group">
            <label>* Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging In...' : 'Login'}
          </button>
        </form>

        <p className="signup-link">
          Need an account? Contact admin to create one
        </p>
      </div>
    </div>
  );
}
