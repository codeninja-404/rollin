import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, ctx: RouteContext<'/api/admin/students/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const [studentRes, classesRes, attendanceRes] = await Promise.all([
    admin.from('students').select('*').eq('id', id).single(),
    admin.from('class_students').select('*, class:classes(*)').eq('student_id', id),
    admin.from('attendance')
      .select('*, session:attendance_sessions(*, class:classes(*))')
      .eq('student_id', id)
      .order('marked_at', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    student: studentRes.data,
    classes: classesRes.data ?? [],
    attendance: attendanceRes.data ?? [],
  });
}

// PATCH /api/admin/students/[id] — update student details
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/students/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();
  const { name, student_code, email, department, semester, section, status } = body;

  const admin = createAdminClient();

  // 1. Fetch current student
  const { data: currentStudent, error: findError } = await admin
    .from('students')
    .select('*')
    .eq('id', id)
    .single();

  if (findError || !currentStudent) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // 2. Validate student_code uniqueness if updated
  if (student_code) {
    const code = String(student_code).trim();
    const { data: existingCode } = await admin
      .from('students')
      .select('id')
      .ilike('student_code', code)
      .neq('id', id)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        { error: `Student code '${code}' is already assigned to another student.` },
        { status: 409 }
      );
    }
  }

  // 3. Validate email uniqueness if updated
  if (email) {
    const em = String(email).trim().toLowerCase();
    const { data: existingEmail } = await admin
      .from('students')
      .select('id')
      .ilike('email', em)
      .neq('id', id)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: `Email '${em}' is already in use by another student.` },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) updateData.name = String(name).trim();
  if (student_code !== undefined) updateData.student_code = String(student_code).trim();
  if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
  if (department !== undefined) updateData.department = department ? String(department).trim() : null;
  if (semester !== undefined) updateData.semester = semester !== null && semester !== undefined ? Number(semester) : null;
  if (section !== undefined) updateData.section = section ? String(section).trim() : null;
  if (status !== undefined) updateData.status = status;

  // Update student in database
  const { data: updatedStudent, error: updateError } = await admin
    .from('students')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If email was updated and an auth user exists, sync auth user email as well
  if (email && currentStudent.auth_user_id) {
    try {
      await admin.auth.admin.updateUserById(currentStudent.auth_user_id, {
        email: String(email).trim().toLowerCase(),
      });
    } catch {
      // Non-blocking if auth email update fails
    }
  }

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'student.update',
    entity: 'students',
    entity_id: id,
    metadata: updateData,
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ student: updatedStudent });
}

// DELETE /api/admin/students/[id] — delete student
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/admin/students/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // Find student first to get auth_user_id if any
  const { data: student } = await admin
    .from('students')
    .select('id, name, student_code, auth_user_id')
    .eq('id', id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Delete student record (cascades to class_students and attendance)
  const { error: deleteError } = await admin
    .from('students')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // If student had a linked auth user account, delete it cleanly
  if (student.auth_user_id) {
    try {
      await admin.auth.admin.deleteUser(student.auth_user_id);
    } catch {
      // Non-blocking
    }
  }

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'student.delete',
    entity: 'students',
    entity_id: id,
    metadata: { name: student.name, student_code: student.student_code },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ success: true });
}

