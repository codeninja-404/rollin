import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { validateOTP } from '@/lib/otp';
import { getClientIP, validateCampusIP } from '@/lib/ip';

// POST /api/attendance/submit — full 10-step server validation
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') ?? '';

  // Step 1: Authenticated?
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await request.json();
  const { session_id, otp } = body;

  if (!session_id || !otp) {
    return NextResponse.json({ error: 'session_id and otp are required.' }, { status: 400 });
  }

  // Step 2: Student exists?
  const { data: student } = await admin
    .from('students')
    .select('id, status')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: 'Student record not found.' }, { status: 403 });
  }

  // Step 3: Student active?
  if (student.status !== 'active') {
    return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 });
  }

  // Step 4: Session exists?
  const { data: session } = await admin
    .from('attendance_sessions')
    .select('id, class_id, status, otp_secret, otp_period')
    .eq('id', session_id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Attendance session not found.' }, { status: 404 });
  }

  // Step 5: Session OPEN?
  if (session.status !== 'open') {
    return NextResponse.json({ error: 'This attendance session is no longer open.' }, { status: 400 });
  }

  // Step 6: Student assigned to class?
  const { data: assignment } = await admin
    .from('class_students')
    .select('id')
    .eq('class_id', session.class_id)
    .eq('student_id', student.id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'You are not enrolled in this class.' }, { status: 403 });
  }

  // Step 7: Campus IP valid?
  const ipCheck = await validateCampusIP(ip);
  if (!ipCheck.valid) {
    return NextResponse.json({ error: ipCheck.message }, { status: 403 });
  }

  // Step 8: OTP valid?
  const period = Math.max(3, session.otp_period || 5);
  const otpValid = validateOTP(session.otp_secret, String(otp).trim(), period);
  if (!otpValid) {
    return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 400 });
  }

  // Step 9: Already attended?
  const { data: existing } = await admin
    .from('attendance')
    .select('id')
    .eq('session_id', session_id)
    .eq('student_id', student.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'You have already submitted attendance for this session.' }, { status: 409 });
  }

  // Step 10: Record attendance
  const { data: attendance, error: insertError } = await admin
    .from('attendance')
    .insert({
      session_id,
      student_id: student.id,
      ip_address: ip,
      user_agent: userAgent,
      status: 'present',
    })
    .select()
    .single();

  if (insertError) {
    // Duplicate constraint hit — already attended
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Attendance already recorded.' }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'attendance.submit',
    entity: 'attendance',
    entity_id: attendance.id,
    ip_address: ip,
    metadata: { session_id, student_id: student.id },
  });

  return NextResponse.json({ success: true, attendance });
}
