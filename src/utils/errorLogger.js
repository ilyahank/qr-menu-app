// System Logging Utility v2
// Logs errors, warnings, info, security events to system_logs table
// Uses JSONB directly (no stringification)

import { supabase } from '../supabase';

const getCurrentUser = () => {
  try {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const logError = async (error, context = {}, severity = 'medium') => {
  const user = getCurrentUser();
  const logData = {
    log_type: 'error',
    message: error.message || String(error),
    context: context, // JSONB directly, no stringification
    user_id: user?.id || null,
    restaurant_id: user?.restaurant_id || null,
    url: window.location.href,
    user_agent: navigator.userAgent,
    severity: severity
  };

  // Log to console
  console.error('Error logged:', logData);

  // Log to Supabase system_logs table
  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
  }
};

export const logWarning = async (message, context = {}) => {
  const user = getCurrentUser();
  const logData = {
    log_type: 'warning',
    message: message,
    context: context,
    user_id: user?.id || null,
    restaurant_id: user?.restaurant_id || null,
    url: window.location.href,
    severity: 'low'
  };

  console.warn('Warning logged:', logData);

  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log warning to database:', logError);
  }
};

export const logInfo = async (message, context = {}) => {
  const user = getCurrentUser();
  const logData = {
    log_type: 'info',
    message: message,
    context: context,
    user_id: user?.id || null,
    restaurant_id: user?.restaurant_id || null,
    url: window.location.href,
    severity: 'low'
  };

  console.log('Info logged:', logData);

  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log info to database:', logError);
  }
};

export const logSecurity = async (message, context = {}) => {
  const user = getCurrentUser();
  const logData = {
    log_type: 'security',
    message: message,
    context: context,
    user_id: user?.id || null,
    restaurant_id: user?.restaurant_id || null,
    url: window.location.href,
    user_agent: navigator.userAgent,
    severity: 'high'
  };

  console.warn('Security event logged:', logData);

  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log security event to database:', logError);
  }
};

export const logPayment = async (message, context = {}) => {
  const user = getCurrentUser();
  const logData = {
    log_type: 'payment',
    message: message,
    context: context,
    user_id: user?.id || null,
    restaurant_id: user?.restaurant_id || null,
    url: window.location.href,
    severity: 'high'
  };

  console.log('Payment logged:', logData);

  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log payment to database:', logError);
  }
};

export const logOrder = async (message, context = {}) => {
  const user = getCurrentUser();
  const logData = {
    log_type: 'order',
    message: message,
    context: context,
    user_id: user?.id || null,
    restaurant_id: user?.restaurant_id || null,
    url: window.location.href,
    severity: 'medium'
  };

  console.log('Order logged:', logData);

  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log order to database:', logError);
  }
};

export const logLogin = async (username, success = true) => {
  const logData = {
    log_type: 'login',
    message: success ? `User login successful: ${username}` : `Failed login attempt: ${username}`,
    context: { username, success },
    url: window.location.href,
    user_agent: navigator.userAgent,
    severity: success ? 'low' : 'medium'
  };

  console.log('Login logged:', logData);

  try {
    await supabase.from('system_logs').insert([logData]);
  } catch (logError) {
    console.error('Failed to log login to database:', logError);
  }
};
