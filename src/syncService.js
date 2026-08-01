// src/syncService.js
// Pulls the menu + restaurant info from Supabase into the local SQLite cache.
// Call this whenever the app has internet (e.g. on dashboard load, or a "Sync" button).

import { supabase } from './supabase';
import * as localApi from './localApi';

export async function syncMenuAndRestaurantToLocal(restaurantId) {
  try {
    // 1. Pull restaurant identity + contact info
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('id, name, tagline, color, logo, phone, facebook, instagram, email_contact')
      .eq('id', restaurantId)
      .single();
    if (restError) throw restError;

    await localApi.syncRestaurantInfo(restaurant);

    // 2. Pull categories + menu items
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, icon')
      .eq('restaurant_id', restaurantId);
    if (catError) throw catError;

    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, category_id, name, price, description, image, deleted_at')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null);
    if (itemsError) throw itemsError;

    // Map deleted_at -> is_active for the local cache shape
    const itemsShaped = (items || []).map(it => ({ ...it, is_active: true }));

    const result = await localApi.syncMenuToLocal(categories || [], itemsShaped);

    return { success: true, ...result.synced };
  } catch (err) {
    console.error('Sync failed:', err);
    return { success: false, error: err.message };
  }
}

// Convenience: sync automatically when the browser comes online
export function watchAndAutoSync(restaurantId) {
  const trySync = () => {
    if (navigator.onLine) {
      syncMenuAndRestaurantToLocal(restaurantId);
    }
  };
  trySync(); // try once immediately
  window.addEventListener('online', trySync);
  return () => window.removeEventListener('online', trySync);
}
