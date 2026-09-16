import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/admin/networks
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: networks, error } = await admin
    .from('campus_networks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ networks });
}

// POST /api/admin/networks — add a network
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, cidr } = await request.json();
  if (!name || !cidr) return NextResponse.json({ error: 'name and cidr required' }, { status: 400 });

  // Basic CIDR validation
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(cidr)) {
    return NextResponse.json({ error: 'Invalid CIDR format' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('campus_networks')
    .insert({ name, cidr, status: 'active' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'network.create',
    entity: 'campus_networks',
    entity_id: data.id,
    metadata: { name, cidr },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ network: data });
}
