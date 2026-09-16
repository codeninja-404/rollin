import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/admin/classes — list all classes
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: classes, error } = await admin
    .from('classes')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ classes });
}

// POST /api/admin/classes — create a class
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { course_code, name, department, semester, section } = body;

  if (!course_code || !name) {
    return NextResponse.json({ error: 'course_code and name are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from('classes').insert({
    course_code,
    name,
    department: department || null,
    semester: semester || null,
    section: section || null,
    status: 'active',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'class.create',
    entity: 'classes',
    entity_id: data.id,
    metadata: { course_code, name },
    ip_address: request.headers.get('x-real-ip') ?? null,
  });

  return NextResponse.json({ class: data });
}
