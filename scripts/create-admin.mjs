// Script: create-admin.mjs
// Usage: node create-admin.mjs <email> <password> <name>
// Example: node create-admin.mjs admin@school.edu mypassword123 "School Admin"

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwdldjfkslvfclmwkkjt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZGxkamZrc2x2ZmNsbXdra2p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUzNjA1NSwiZXhwIjoyMTA1MTEyMDU1fQ.VPd6V_5hopqLORtq5Lxpzf2DUXYfbN6-kQMo9N3i7nc';

const [email, password, name = 'Admin'] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node create-admin.mjs <email> <password> [name]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\nCreating admin: ${email} (${name})`);

// 1. Create auth user
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (authError) {
  console.error('❌ Auth user creation failed:', authError.message);
  process.exit(1);
}

const userId = authData.user.id;
console.log(`✅ Auth user created: ${userId}`);

// 2. Insert admin_users record
const { error: insertError } = await supabase.from('admin_users').insert({
  auth_user_id: userId,
  name,
  email,
});

if (insertError) {
  console.error('❌ admin_users insert failed:', insertError.message);
  // Clean up the auth user
  await supabase.auth.admin.deleteUser(userId);
  process.exit(1);
}

console.log(`✅ Admin record created in admin_users`);
console.log(`\n🎉 Done! You can now log in at http://localhost:3000/login`);
console.log(`   Email:    ${email}`);
console.log(`   Password: ${password}`);
