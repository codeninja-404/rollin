import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwdldjfkslvfclmwkkjt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZGxkamZrc2x2ZmNsbXdra2p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUzNjA1NSwiZXhwIjoyMTA1MTEyMDU1fQ.VPd6V_5hopqLORtq5Lxpzf2DUXYfbN6-kQMo9N3i7nc';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function inspect() {
  console.log('--- AUTH USERS ---');
  const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) console.error(uErr);
  else {
    usersData.users.forEach((u) => {
      console.log(`User: ${u.email} | ID: ${u.id} | Confirmed: ${u.email_confirmed_at}`);
    });
  }

  console.log('--- STUDENTS ---');
  const { data: students, error: sErr } = await supabase.from('students').select('*');
  if (sErr) console.error(sErr);
  else {
    students.forEach((s) => {
      console.log(`Student: ${s.name} (${s.student_code}) | Email: ${s.email} | auth_user_id: ${s.auth_user_id}`);
    });
  }
}

inspect();
