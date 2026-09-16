import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// PATCH /api/admin/networks/[id]
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/networks/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await request.json();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('campus_networks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ network: data });
}

// DELETE /api/admin/networks/[id]
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/admin/networks/[id]'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { error } = await admin.from('campus_networks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'network.delete',
    entity: 'campus_networks',
    entity_id: id,
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ success: true });
}
