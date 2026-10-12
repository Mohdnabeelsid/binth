/**
 * BINTH.IN — Supabase Client Wrapper
 * Exposes the official @supabase/supabase-js client using environment credentials.
 */

const path = require('path');

if (!process.env.SUPABASE_URL) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) {
    // ignore
  }
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://umdddskhlqgerbevcwca.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

module.exports = supabase;
