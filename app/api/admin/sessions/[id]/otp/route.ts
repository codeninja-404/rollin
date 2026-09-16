import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCurrentOTP, getSecondsRemaining } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/admin/sessions/[id]/otp — get current OTP for admin display
export async function GET(request: NextRequest, ctx: RouteContext<'/api/admin/sessions/[id]/otp'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data: session, error } = await admin
    .from('attendance_sessions')
    .select('id, status, otp_secret')
    .eq('id', id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.status !== 'open') {
    return NextResponse.json({ error: 'Session is closed' }, { status: 400 });
  }

  const otp = getCurrentOTP(session.otp_secret);
  const seconds_remaining = getSecondsRemaining();

  return NextResponse.json(
    { otp, seconds_remaining, period: 5 },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
