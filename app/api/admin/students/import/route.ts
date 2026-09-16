import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { CsvStudentRow } from '@/lib/types';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const students: CsvStudentRow[] = body.students ?? [];

  if (!students.length) {
    return NextResponse.json({ error: 'No students to import' }, { status: 400 });
  }

  const admin = createAdminClient();
  let imported = 0;
  const errors: string[] = [];

  for (const row of students) {
    try {
      // Create auth user with a random password (they'll reset it)
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: row.email,
        password: Math.random().toString(36).slice(-12) + 'A1!',
        email_confirm: true,
      });

      if (authError) {
        errors.push(`${row.email}: ${authError.message}`);
        continue;
      }

      const { error: insertError } = await admin.from('students').insert({
        auth_user_id: authUser.user.id,
        student_code: row.student_code,
        name: row.name,
        email: row.email,
        department: row.department || null,
        semester: row.semester ? parseInt(row.semester, 10) : null,
        section: row.section || null,
        status: 'active',
      });

      if (insertError) {
        errors.push(`${row.email}: ${insertError.message}`);
        // Clean up auth user if student insert failed
        await admin.auth.admin.deleteUser(authUser.user.id);
      } else {
        imported++;
      }
    } catch (err: any) {
      errors.push(`${row.email}: ${err.message}`);
    }
  }

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'student.import',
    entity: 'students',
    metadata: { imported, errors: errors.slice(0, 10) },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ imported, errors });
}
