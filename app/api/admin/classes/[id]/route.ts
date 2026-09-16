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
