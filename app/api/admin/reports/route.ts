import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const filterClassId = searchParams.get('class_id') || undefined;
  const filterDepartment = searchParams.get('department') || undefined;

  // Batch query all core data in parallel for maximum speed
  const [classesRes, sessionsRes, classStudentsRes, attendanceRes] = await Promise.all([
    admin.from('classes').select('id, course_code, name, department, semester, section, status').order('course_code'),
    admin.from('attendance_sessions').select('id, class_id, started_at, ended_at, status, otp_period').order('started_at', { ascending: false }),
    admin.from('class_students').select('id, class_id, student_id, student:students(id, student_code, name, email, department, semester, section, status)'),
    admin.from('attendance').select('id, session_id, student_id, marked_at, status'),
  ]);

  const allClasses = classesRes.data ?? [];
  const allSessions = sessionsRes.data ?? [];
  const allClassStudents = classStudentsRes.data ?? [];
  const allAttendances = attendanceRes.data ?? [];

  // Index sessions by class_id
  const sessionsByClass: Record<string, typeof allSessions> = {};
  allSessions.forEach((s) => {
    if (!sessionsByClass[s.class_id]) sessionsByClass[s.class_id] = [];
    sessionsByClass[s.class_id].push(s);
  });

  // Index attendance by session_id and student_id
  const attendanceSet = new Set<string>();
  const attendancesBySession: Record<string, number> = {};
  allAttendances.forEach((a) => {
    attendanceSet.add(`${a.session_id}:${a.student_id}`);
    attendancesBySession[a.session_id] = (attendancesBySession[a.session_id] ?? 0) + 1;
  });

  // Unique departments
  const departmentSet = new Set<string>();
  allClasses.forEach((c) => {
    if (c.department) departmentSet.add(c.department);
  });

  // 1. Build Class Reports
  const classReports = allClasses
    .filter((c) => {
      if (filterClassId && c.id !== filterClassId) return false;
      if (filterDepartment && c.department !== filterDepartment) return false;
      return true;
    })
    .map((c) => {
      const classSessions = sessionsByClass[c.id] ?? [];
      const enrolled = allClassStudents.filter((cs) => cs.class_id === c.id);
      const studentCount = enrolled.length;
      const sessionCount = classSessions.length;

      let totalAttendances = 0;
      classSessions.forEach((s) => {
        totalAttendances += attendancesBySession[s.id] ?? 0;
      });

      const totalPossible = studentCount * sessionCount;
      const avgPercent = totalPossible > 0 ? Math.round((totalAttendances / totalPossible) * 100) : 0;

      return {
        class_id: c.id,
        class_name: c.name,
        course_code: c.course_code,
        department: c.department || 'N/A',
        semester: c.semester,
        section: c.section,
        status: c.status,
        total_students: studentCount,
        total_sessions: sessionCount,
        total_attendances: totalAttendances,
        avg_percent: avgPercent,
      };
    });

  // 2. Build Student Reports (CRUCIAL: Include ALL enrolled students!)
  const studentReports: Array<{
    student_id: string;
    student_code: string;
    student_name: string;
    email: string;
    class_id: string;
    class_name: string;
    course_code: string;
    department: string;
    semester: number | null;
    section: string | null;
    sessions: number;
    present: number;
    missed: number;
    percent: number;
    status_tier: 'good' | 'warning' | 'critical';
  }> = [];

  allClassStudents.forEach((cs) => {
    const cls = allClasses.find((c) => c.id === cs.class_id);
    if (!cls) return;

    if (filterClassId && cls.id !== filterClassId) return;
    if (filterDepartment && cls.department !== filterDepartment) return;

    const student = cs.student as any;
    if (!student) return;

    const classSessions = sessionsByClass[cls.id] ?? [];
    const totalSessions = classSessions.length;

    let present = 0;
    classSessions.forEach((s) => {
      if (attendanceSet.has(`${s.id}:${student.id}`)) {
        present++;
      }
    });

    const missed = Math.max(0, totalSessions - present);
    const percent = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 100;

    let status_tier: 'good' | 'warning' | 'critical' = 'good';
    if (totalSessions > 0) {
      if (percent < 50) status_tier = 'critical';
      else if (percent < 75) status_tier = 'warning';
    }

    studentReports.push({
      student_id: student.id,
      student_code: student.student_code,
      student_name: student.name,
      email: student.email,
      class_id: cls.id,
      class_name: cls.name,
      course_code: cls.course_code,
      department: cls.department || student.department || 'N/A',
      semester: cls.semester ?? student.semester ?? null,
      section: cls.section ?? student.section ?? null,
      sessions: totalSessions,
      present,
      missed,
      percent,
      status_tier,
    });
  });

  // Sort student reports: lowest attendance percent first (so at-risk students are immediately visible)
  studentReports.sort((a, b) => a.percent - b.percent);

  // 3. Build Detailed Session Logs
  const sessionLogs = allSessions
    .filter((s) => {
      const cls = allClasses.find((c) => c.id === s.class_id);
      if (!cls) return false;
      if (filterClassId && cls.id !== filterClassId) return false;
      if (filterDepartment && cls.department !== filterDepartment) return false;
      return true;
    })
    .map((s) => {
      const cls = allClasses.find((c) => c.id === s.class_id);
      const enrolled = allClassStudents.filter((cs) => cs.class_id === s.class_id).length;
      const present = attendancesBySession[s.id] ?? 0;
      const percent = enrolled > 0 ? Math.round((present / enrolled) * 100) : 0;

      return {
        session_id: s.id,
        class_id: s.class_id,
        class_name: cls?.name ?? 'Unknown',
        course_code: cls?.course_code ?? '?',
        department: cls?.department ?? 'N/A',
        started_at: s.started_at,
        ended_at: s.ended_at,
        status: s.status,
        otp_period: s.otp_period || 5,
        total_enrolled: enrolled,
        present_count: present,
        absent_count: Math.max(0, enrolled - present),
        percent,
      };
    });

  // 4. Overall KPIs Summary
  let totalPossibleAll = 0;
  let totalAttendancesAll = 0;
  allSessions.forEach((s) => {
    const enrolled = allClassStudents.filter((cs) => cs.class_id === s.class_id).length;
    totalPossibleAll += enrolled;
    totalAttendancesAll += attendancesBySession[s.id] ?? 0;
  });

  const overallRate = totalPossibleAll > 0 ? Math.round((totalAttendancesAll / totalPossibleAll) * 100) : 0;
  const atRiskCount = studentReports.filter((s) => s.sessions > 0 && s.percent < 75).length;
  const uniqueEnrolledStudents = new Set(allClassStudents.map((cs) => cs.student_id)).size;

  return NextResponse.json({
    kpis: {
      overallRate,
      totalClasses: allClasses.length,
      totalSessions: allSessions.length,
      totalStudentsEnrolled: uniqueEnrolledStudents,
      atRiskCount,
    },
    classReports,
    studentReports,
    sessionLogs,
    filters: {
      departments: Array.from(departmentSet).sort(),
      classes: allClasses.map((c) => ({
        id: c.id,
        name: c.name,
        course_code: c.course_code,
        department: c.department,
      })),
    },
  });
}
