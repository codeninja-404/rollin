import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwdldjfkslvfclmwkkjt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53ZGxkamZrc2x2ZmNsbXdra2p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUzNjA1NSwiZXhwIjoyMTA1MTEyMDU1fQ.VPd6V_5hopqLORtq5Lxpzf2DUXYfbN6-kQMo9N3i7nc';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testActivation() {
  const cleanEmail = 'saidularefin8@gmail.com';
  const cleanCode = 'STU001';
  const password = 'Password123!';

  console.log('Testing student search...');
  const { data: students, error: findError } = await admin
    .from('students')
    .select('id, student_code, email, name, status, auth_user_id')
    .ilike('email', cleanEmail)
    .ilike('student_code', cleanCode)
    .limit(1);

  console.log('Find result:', students, findError);

  if (students && students[0]) {
    console.log('Trying createUser in Auth...');
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        name: students[0].name,
        student_code: students[0].student_code,
      },
    });
    console.log('Create auth result:', newUser, createError);
  }
}

testActivation();
