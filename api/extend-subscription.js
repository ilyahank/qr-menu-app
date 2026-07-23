const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://hdbewuhbpkfbhowaduun.supabase.co';
// Use service_role key to bypass RLS on the server side, fall back to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYmV3dWhicGtmYmhvd2FkdXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDI5MzQsImV4cCI6MjA5NzIxODkzNH0.RhaY4nmyvedimY4RhZcjWtm0SopnTWleW4zYUl0NYHc';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Verify Authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Check if the user is the admin email
    if (user.email !== 'ilyashannouna@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    // 2. Parse request body
    const { restaurant_id, duration_days, extend_notes, start_date } = req.body;
    if (!restaurant_id || !duration_days) {
      return res.status(400).json({ error: 'Missing restaurant_id or duration_days' });
    }

    const durationDays = parseInt(duration_days);
    if (isNaN(durationDays) || durationDays <= 0) {
      return res.status(400).json({ error: 'Invalid duration_days' });
    }

    // 3. Check current subscription end date
    const { data: subData, error: subFetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    if (subFetchError) {
      return res.status(500).json({ error: 'Failed to fetch subscription: ' + subFetchError.message });
    }

    let currentEndDate = null;
    let newEndDate = new Date();
    let computedStartDate = new Date();

    if (subData && subData.end_date) {
      currentEndDate = new Date(subData.end_date);
      const today = new Date();
      
      if (currentEndDate > today) {
        // Active: extend from the old end date
        newEndDate = new Date(currentEndDate);
        newEndDate.setDate(newEndDate.getDate() + durationDays);
      } else {
        // Expired: extend from today
        newEndDate.setDate(newEndDate.getDate() + durationDays);
      }
    } else {
      // No subscription record: start from start_date parameter or today
      if (start_date) {
        computedStartDate = new Date(start_date);
      }
      newEndDate = new Date(computedStartDate);
      newEndDate.setDate(newEndDate.getDate() + durationDays);
    }

    newEndDate.setHours(23, 59, 59, 999);

    // Determine new status
    const today = new Date();
    const diffTime = newEndDate - today;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const status = days <= 0 ? 'expired' : (days <= 7 ? 'expiring_soon' : 'active');

    // 4. Update or Insert Subscription (using service_role client)
    if (subData) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          end_date: newEndDate,
          status: status,
          updated_at: new Date()
        })
        .eq('restaurant_id', restaurant_id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert([{
          restaurant_id: restaurant_id,
          start_date: computedStartDate,
          end_date: newEndDate,
          status: status
        }]);

      if (insertError) throw insertError;
    }

    // 5. Log to history (using service_role client)
    const { error: histError } = await supabase
      .from('subscription_history')
      .insert([{
        restaurant_id: restaurant_id,
        extended_by: user.id,
        action_type: subData ? 'extend' : 'create',
        old_end_date: currentEndDate,
        new_end_date: newEndDate,
        duration_days: durationDays,
        notes: extend_notes || (subData ? 'Manual extension' : 'Initial creation')
      }]);

    if (histError) {
      console.error('Failed to log subscription history:', histError);
    }

    return res.status(200).json({
      message: 'Subscription updated successfully',
      newEndDate: newEndDate.toISOString(),
      status: status
    });

  } catch (error) {
    console.error('Error in extend-subscription:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
