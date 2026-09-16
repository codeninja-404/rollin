import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Class reports: avg attendance percent per class
  const { data: sessions } = await admin
    .from('attendance_sessions')
    .select('id, class_id, class:classes(name, course_code)')
    .eq('status', 'closed');

  const classMap: Record<string, { class_id: string; class_name: string; course_code: string; total_sessions: number; total_attendances: number }> = {};

  if (sessions) {
    for (const s of sessions) {
      const key = s.class_id;
      if (!classMap[key]) {
        classMap[key] = {
          class_id: s.class_id,
          class_name: (s.class as any)?.name ?? '?',
          course_code: (s.class as any)?.course_code ?? '?',
          total_sessions: 0,
          total_attendances: 0,
        };
      }
      classMap[key].total_sessions++;

      const { count } = await admin
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', s.id);

      classMap[key].total_attendances += count ?? 0;
    }
  }

  // Per-class student count and avg %
  const classReports = await Promise.all(
    Object.values(classMap).map(async (c) => {
      const { count: studentCount } = await admin
        .from('class_students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', c.class_id);

      const total = (studentCount ?? 0) * c.total_sessions;
      const avg_percent = total > 0 ? Math.round((c.total_attendances / total) * 100) : 0;

      return { ...c, total_students: studentCount ?? 0, avg_percent };
    }),
  );

  // Student reports
  const { data: attendanceData } = await admin
    .from('attendance')
    .select('student_id, session_id, student:students(name, student_code), session:attendance_sessions(class_id, class:classes(name))');

  const studentClassMap: Record<string, { student_id: string; student_name: string; student_code: string; class_name: string; class_id: string; present: number }> = {};

  (attendanceData ?? []).forEach((a: Record<string, any>) => {
    const key = `${a.student_id}-${a.session?.class_id}`;
    if (!studentClassMap[key]) {
      studentClassMap[key] = {
        student_id: a.student_id,
        student_name: a.student?.name ?? '?',
        student_code: a.student?.student_code ?? '?',
        class_name: a.session?.class?.name ?? '?',
        class_id: a.session?.class_id,
        present: 0,
      };
    }
    studentClassMap[key].present++;
  });

  const sessionCountMap: Record<string, number> = {};
  (sessions ?? []).forEach((s: { class_id: string }) => {
    sessionCountMap[s.class_id] = (sessionCountMap[s.class_id] ?? 0) + 1;
  });

  const studentReports = Object.values(studentClassMap).map((s) => ({
    ...s,
    sessions: sessionCountMap[s.class_id] ?? 0,
    percent: sessionCountMap[s.class_id]
      ? Math.round((s.present / sessionCountMap[s.class_id]) * 100)
      : 0,
  }));

  return NextResponse.json({ classReports, studentReports });
}
