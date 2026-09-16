import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/admin/sessions/[id] — session detail with attendance
export async function GET(request: NextRequest, ctx: RouteContext<'/api/admin/sessions/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const [sessionRes, attendanceRes, totalStudentsRes] = await Promise.all([
    admin.from('attendance_sessions')
      .select('*, class:classes(*)')
      .eq('id', id)
      .single(),
    admin.from('attendance')
      .select('*, student:students(*)')
      .eq('session_id', id)
      .order('marked_at'),
    // Count enrolled students for this class
    admin.from('attendance_sessions')
      .select('class_id')
      .eq('id', id)
      .single()
      .then(async (res: { data: { class_id: string } | null; error: any }) => {
        if (!res.data) return { count: 0 };
        const { count } = await admin
          .from('class_students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', res.data.class_id);
        return { count: count ?? 0 };
      }),
  ]);

  return NextResponse.json({
    session: sessionRes.data,
    attendance: attendanceRes.data ?? [],
    totalStudents: totalStudentsRes.count,
  });
}

// PATCH /api/admin/sessions/[id] — close session
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/sessions/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const { status } = await request.json();

  if (status !== 'closed') {
    return NextResponse.json({ error: 'Only "closed" status is supported' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('attendance_sessions')
    .update({ status: 'closed', ended_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'attendance.close',
    entity: 'attendance_sessions',
    entity_id: id,
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ session: data });
}
