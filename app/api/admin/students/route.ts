import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// GET /api/admin/students — list students with server-side pagination, search, and filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const searchParams = request.nextUrl.searchParams;

  const isAll = searchParams.get('all') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
  const search = searchParams.get('search') || '';
  const department = searchParams.get('department') || 'all';
  const semester = searchParams.get('semester') || 'all';
  const section = searchParams.get('section') || 'all';
  const status = searchParams.get('status') || 'all';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

  // Base query with count
  let query = admin.from('students').select('*', { count: 'exact' });

  // Text search across name, student_code, and email
  if (search.trim()) {
    const s = search.trim();
    query = query.or(`name.ilike.%${s}%,student_code.ilike.%${s}%,email.ilike.%${s}%`);
  }

  // Department filter
  if (department !== 'all') {
    query = query.eq('department', department);
  }

  // Semester filter
  if (semester !== 'all') {
    const semNum = parseInt(semester, 10);
    if (!isNaN(semNum)) {
      query = query.eq('semester', semNum);
    }
  }

  // Section filter
  if (section !== 'all') {
    query = query.eq('section', section);
  }

  // Status filter
  if (status !== 'all') {
    query = query.eq('status', status);
  }

  // Sorting
  const validSortColumns = ['name', 'student_code', 'email', 'department', 'semester', 'created_at', 'status'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
  query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Pagination or return all
  if (!isAll) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const [{ data: students, count, error }, { data: metaList }] = await Promise.all([
    query,
    // Fetch unique filter values across all students
    admin.from('students').select('department, semester, section'),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Extract unique departments, semesters, sections for filter options
  const deptSet = new Set<string>();
  const semSet = new Set<number>();
  const secSet = new Set<string>();

  (metaList as Array<{ department: string | null; semester: number | null; section: string | null }> || []).forEach((row) => {
    if (row.department) deptSet.add(row.department);
    if (row.semester !== null && row.semester !== undefined) semSet.add(row.semester);
    if (row.section) secSet.add(row.section);
  });

  const total = count ?? (students?.length || 0);

  return NextResponse.json({
    students: students ?? [],
    total,
    page: isAll ? 1 : page,
    limit: isAll ? total : limit,
    totalPages: isAll ? 1 : Math.ceil(total / limit),
    departments: Array.from(deptSet).sort(),
    semesters: Array.from(semSet).sort((a, b) => a - b),
    sections: Array.from(secSet).sort(),
  });
}

// POST /api/admin/students — manually add a single student
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { student_code, name, email, department, semester, section } = body;

    if (!student_code?.trim() || !name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Student code, name, and email are required.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check for duplicate student code or email
    const { data: existing } = await admin
      .from('students')
      .select('student_code, email')
      .or(`student_code.eq.${student_code.trim()},email.eq.${email.trim()}`)
      .limit(1);

    if (existing && existing.length > 0) {
      const match = existing[0];
      const conflictField = match.student_code.toLowerCase() === student_code.trim().toLowerCase()
        ? 'student code'
        : 'email address';
      return NextResponse.json(
        { error: `A student with this ${conflictField} already exists.` },
        { status: 409 }
      );
    }

    const { data: newStudent, error } = await admin
      .from('students')
      .insert({
        student_code: student_code.trim().toUpperCase(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department?.trim() || null,
        semester: semester ? Number(semester) : null,
        section: section?.trim() || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ student: newStudent }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
