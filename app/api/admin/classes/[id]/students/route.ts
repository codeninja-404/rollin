import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// POST — assign student to class
export async function POST(request: NextRequest, ctx: RouteContext<'/api/admin/classes/[id]/students'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: class_id } = await ctx.params;
  const { student_id } = await request.json();

  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('class_students').upsert(
    { class_id, student_id, status: 'active' },
    { onConflict: 'class_id,student_id', ignoreDuplicates: false },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'student.assign',
    entity: 'class_students',
    entity_id: class_id,
    metadata: { student_id },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ success: true });
}

// DELETE — remove student from class
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/admin/classes/[id]/students'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: class_id } = await ctx.params;
  const { student_id } = await request.json();

  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('class_students')
    .delete()
    .eq('class_id', class_id)
    .eq('student_id', student_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'student.unassign',
    entity: 'class_students',
    entity_id: class_id,
    metadata: { student_id },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ success: true });
}
