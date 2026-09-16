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
    // Fetch enrolled students for this class
    admin.from('attendance_sessions')
      .select('class_id')
      .eq('id', id)
      .single()
      .then(async (res: { data: { class_id: string } | null; error: any }) => {
        if (!res.data) return { count: 0, students: [] };
        const { data, count } = await admin
          .from('class_students')
          .select('*, student:students(*)', { count: 'exact' })
          .eq('class_id', res.data.class_id);
        return { count: count ?? 0, students: data ?? [] };
      }),
  ]);

  return NextResponse.json({
    session: sessionRes.data,
    attendance: attendanceRes.data ?? [],
    totalStudents: totalStudentsRes.count,
    enrolledStudents: totalStudentsRes.students,
  });
}

// PATCH /api/admin/sessions/[id] — update session (close or change otp_period)
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/sessions/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();
  const { status, otp_period } = body;

  const admin = createAdminClient();
  const updatePayload: Record<string, any> = {};

  if (status === 'closed') {
    updatePayload.status = 'closed';
    updatePayload.ended_at = new Date().toISOString();
  }

  if (otp_period !== undefined) {
    updatePayload.otp_period = Math.max(3, Math.min(120, Number(otp_period) || 5));
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('attendance_sessions')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: status === 'closed' ? 'attendance.close' : 'attendance.update_period',
    entity: 'attendance_sessions',
    entity_id: id,
    ip_address: request.headers.get('x-real-ip') ?? null,
    metadata: updatePayload,
  });

  return NextResponse.json({ session: data });
}
