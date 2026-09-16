import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/admin/students — list all students
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: students, error } = await admin
    .from('students')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students });
}

// POST /api/admin/students — manually add a single student
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { student_code, name, email, department, semester, section } = body;

    if (!student_code?.trim() || !name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Student code, name, and email are required.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check for duplicate student code or email
    const { data: existing } = await admin
      .from('students')
      .select('student_code, email')
      .or(`student_code.eq.${student_code.trim()},email.eq.${email.trim()}`)
      .limit(1);

    if (existing && existing.length > 0) {
      const match = existing[0];
      const conflictField = match.student_code.toLowerCase() === student_code.trim().toLowerCase()
        ? 'student code'
        : 'email address';
      return NextResponse.json(
        { error: `A student with this ${conflictField} already exists.` },
        { status: 409 }
      );
    }

    const { data: newStudent, error } = await admin
      .from('students')
      .insert({
        student_code: student_code.trim().toUpperCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department?.trim() || null,
        semester: semester ? Number(semester) : null,
        section: section?.trim() || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ student: newStudent }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
