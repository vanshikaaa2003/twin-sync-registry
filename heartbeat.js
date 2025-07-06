// core/registry/heartbeat.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function pingSupabase() {
  const { error } = await supabase.from('heartbeat_logs').insert({});
  if (error) {
    console.error('❌ Heartbeat insert failed:', error.message);
  } else {
    console.log('✅ Heartbeat logged');
  }
}
