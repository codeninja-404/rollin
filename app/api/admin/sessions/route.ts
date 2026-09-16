import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateSecret } from '@/lib/otp';

const { searchParams } = new URL('http://x');

// GET /api/admin/sessions?status=open|closed — list sessions
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status');
  const admin = createAdminClient();

  let query = admin
    .from('attendance_sessions')
    .select('*, class:classes(*)')
    .order('started_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data: sessions, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessions });
}

// POST /api/admin/sessions — open a new attendance session
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { class_id, otp_period } = await request.json();
  if (!class_id) return NextResponse.json({ error: 'class_id required' }, { status: 400 });

  const admin = createAdminClient();

  // Check for already open session for this class
  const { data: existing } = await admin
    .from('attendance_sessions')
    .select('id')
    .eq('class_id', class_id)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'An attendance session is already open for this class.' },
      { status: 409 },
    );
  }

  const otp_secret = generateSecret();
  const period = Math.max(3, Math.min(120, Number(otp_period) || 5));

  const { data: session, error } = await admin
    .from('attendance_sessions')
    .insert({
      class_id,
      otp_secret,
      otp_period: period,
      status: 'open',
      created_by: user.id,
    })
    .select('*, class:classes(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'attendance.open',
    entity: 'attendance_sessions',
    entity_id: session.id,
    metadata: { class_id },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ session });
}
