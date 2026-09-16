import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const [studentsRes, classesRes, openSessionsRes, todayAttendanceRes, recentSessionsRes] =
    await Promise.all([
      admin.from('students').select('id', { count: 'exact', head: true }),
      admin.from('classes').select('id', { count: 'exact', head: true }),
      admin.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('attendance').select('id', { count: 'exact', head: true }).gte('marked_at', new Date().toISOString().slice(0, 10)),
      admin.from('attendance_sessions')
        .select('id, class_id, status, started_at, ended_at, class:classes(id, name, course_code)')
        .order('started_at', { ascending: false })
        .limit(10),
    ]);

  return NextResponse.json({
    stats: {
      totalStudents: studentsRes.count ?? 0,
      totalClasses: classesRes.count ?? 0,
      openSessions: openSessionsRes.count ?? 0,
      todayAttendance: todayAttendanceRes.count ?? 0,
    },
    recentSessions: recentSessionsRes.data ?? [],
  });
}
