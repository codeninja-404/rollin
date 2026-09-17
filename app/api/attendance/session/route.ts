import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/attendance/session — get student's current active session
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Get the student record
  const { data: student } = await admin
    .from('students')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!student) return NextResponse.json({ session: null, already_attended: false });
  if (student.status !== 'active') return NextResponse.json({ session: null, already_attended: false });

  const reqSessionId = request.nextUrl.searchParams.get('session_id');

  // If a specific session_id is requested, prioritize checking that session
  if (reqSessionId) {
    const { data: specificSession } = await admin
      .from('attendance_sessions')
      .select('*, class:classes(*)')
      .eq('id', reqSessionId)
      .maybeSingle();

    if (specificSession && specificSession.status === 'open') {
      const { data: assignment } = await admin
        .from('class_students')
        .select('id')
        .eq('class_id', specificSession.class_id)
        .eq('student_id', student.id)
        .maybeSingle();

      if (assignment) {
        const { data: existing } = await admin
          .from('attendance')
          .select('id, marked_at')
          .eq('session_id', specificSession.id)
          .eq('student_id', student.id)
          .maybeSingle();

        return NextResponse.json({
          session: {
            id: specificSession.id,
            class_id: specificSession.class_id,
            status: specificSession.status,
            started_at: specificSession.started_at,
            class: specificSession.class,
          },
          already_attended: !!existing,
          attendance: existing ?? null,
        });
      }
    }
  }

  // Find open sessions where this student is assigned
  const { data: openSessions } = await admin
    .from('attendance_sessions')
    .select('*, class:classes(*)')
    .eq('status', 'open');

  if (!openSessions || openSessions.length === 0) {
    return NextResponse.json({ session: null, already_attended: false });
  }

  // Find eligible session (student must be assigned to the class)
  for (const session of openSessions) {
    const { data: assignment } = await admin
      .from('class_students')
      .select('id')
      .eq('class_id', session.class_id)
      .eq('student_id', student.id)
      .maybeSingle();

    if (!assignment) continue;

    // Check if already attended
    const { data: existing } = await admin
      .from('attendance')
      .select('id, marked_at')
      .eq('session_id', session.id)
      .eq('student_id', student.id)
      .maybeSingle();

    return NextResponse.json({
      session: {
        id: session.id,
        class_id: session.class_id,
        status: session.status,
        started_at: session.started_at,
        class: session.class,
      },
      already_attended: !!existing,
      attendance: existing ?? null,
    });
  }

  // No eligible session
  return NextResponse.json({ session: null, already_attended: false });
}
