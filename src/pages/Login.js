import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import LangSwitcher from '../components/LangSwitcher';
import restaurantBg from '../assets/restaurant-bg.jpg';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    const user = localStorage.getItem('currentUser');
    if (user) {
      const userData = JSON.parse(user);
      const currentPath = window.location.pathname;
      
      // Only navigate if not already on the correct page
      if (userData.role === 'admin' && currentPath !== '/admin') {
        navigate('/admin');
      } else if (userData.role !== 'admin' && currentPath !== '/dashboard') {
        navigate('/dashboard');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Attempting login with username:', username);

      // Query database
      const { data, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username);

      console.log('Query result:', data, queryError);

      if (queryError) {
        console.error('Query error:', queryError);
        setError('Database error. Try again.');
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.log('User not found');
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const user = data[0];
      console.log('User found:', user.username);

      // Check password
      if (user.password !== password) {
        console.log('Password mismatch');
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      console.log('Login successful!');

      // Store user
      localStorage.setItem('currentUser', JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        restaurant_id: user.restaurant_id
      }));

      // Redirect
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${restaurantBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="login-card">
        <div className="login-lang"><LangSwitcher /></div>
        <h1>IRM</h1>
        <h2>Restaurant Login</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>USERNAME *</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="Enter your username"
            />
          </div>
          
          <div className="form-group">
            <label>PASSWORD *</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Enter your password"
            />
          </div>
          
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

        <p className="signup-link">
          Need an account? Contact admin to create one
        </p>
      </div>
    </div>
  );
}
