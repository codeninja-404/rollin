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
