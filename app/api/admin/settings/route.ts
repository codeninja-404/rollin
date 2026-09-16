import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/settings — get system settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: rows } = await admin.from('system_settings').select('*');

  const settings: Record<string, any> = {
    default_otp_period: 5,
  };

  (rows ?? []).forEach((r: { key: string; value: any }) => {
    settings[r.key] = r.value;
  });

  return NextResponse.json({ settings });
}

// POST /api/admin/settings — update system settings
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  for (const [key, value] of Object.entries(body)) {
    await admin.from('system_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true });
}
