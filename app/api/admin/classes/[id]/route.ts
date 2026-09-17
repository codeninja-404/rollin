import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, ctx: RouteContext<'/api/admin/classes/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const [classRes, sessionsRes, studentsRes, assignedRes] = await Promise.all([
    admin.from('classes').select('*').eq('id', id).single(),
    admin.from('attendance_sessions')
      .select('*')
      .eq('class_id', id)
      .order('started_at', { ascending: false })
      .limit(20),
    admin.from('class_students').select('id', { count: 'exact', head: true }).eq('class_id', id),
    admin.from('class_students').select('*, student:students(*)').eq('class_id', id),
  ]);

  return NextResponse.json({
    class: classRes.data,
    sessions: sessionsRes.data ?? [],
    studentCount: studentsRes.count ?? 0,
    assignedStudents: assignedRes.data ?? [],
  });
}

// PATCH /api/admin/classes/[id] — update class
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/classes/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();
  const { course_code, name, department, semester, section, status } = body;

  const admin = createAdminClient();

  // If updating course_code, verify uniqueness across other classes
  if (course_code) {
    const normalizedCode = course_code.trim();
    const { data: existing } = await admin
      .from('classes')
      .select('id')
      .ilike('course_code', normalizedCode)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `Another class with course code '${normalizedCode}' already exists.` },
        { status: 409 }
      );
    }
  }

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (course_code !== undefined) updateData.course_code = course_code.trim();
  if (name !== undefined) updateData.name = name.trim();
  if (department !== undefined) updateData.department = department || null;
  if (semester !== undefined) updateData.semester = semester || null;
  if (section !== undefined) updateData.section = section || null;
  if (status !== undefined) updateData.status = status;

  const { data: updatedClass, error } = await admin
    .from('classes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'class.update',
    entity: 'classes',
    entity_id: id,
    metadata: updateData,
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ class: updatedClass });
}

// DELETE /api/admin/classes/[id] — delete class
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/admin/classes/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { error } = await admin.from('classes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'class.delete',
    entity: 'classes',
    entity_id: id,
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ success: true });
}

