import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/auth/activate — student self-activation and password setup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_code, email, password } = body;

    if (!student_code?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: 'Student ID, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const cleanCode = student_code.trim();
    const cleanEmail = email.trim().toLowerCase();
    const admin = createAdminClient();

    // 1. Check if student exists in database with matching email and student_code
    const { data: students, error: findError } = await admin
      .from('students')
      .select('id, student_code, email, name, status, auth_user_id')
      .ilike('email', cleanEmail)
      .ilike('student_code', cleanCode)
      .limit(1);

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!students || students.length === 0) {
      return NextResponse.json(
        {
          error:
            'No matching student record found. Please verify your Student ID and university email address, or contact your admin.',
        },
        { status: 404 }
      );
    }

    const student = students[0];

    if (student.status !== 'active') {
      return NextResponse.json(
        { error: 'Your student account is marked inactive. Please contact administration.' },
        { status: 403 }
      );
    }

    let authUserId = student.auth_user_id;

    // 2. If auth_user_id already exists, update password
    if (authUserId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
        password: password,
        email_confirm: true,
      });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // 3. If no auth_user_id linked yet, try creating new auth user
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: 'student',
          name: student.name,
          student_code: student.student_code,
        },
      });

      if (createError) {
        // If user already exists in Supabase Auth (e.g. created previously)
        if (createError.message?.toLowerCase().includes('already') || createError.status === 422) {
          // Find the existing auth user and update their password
          const { data: userList } = await admin.auth.admin.listUsers();
          const existingUser = userList?.users?.find(
            (u: any) => u.email?.toLowerCase() === cleanEmail
          );

          if (existingUser) {
            authUserId = existingUser.id;
            await admin.auth.admin.updateUserById(existingUser.id, {
              password: password,
              email_confirm: true,
            });
          } else {
            return NextResponse.json({ error: createError.message }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }
      } else {
        authUserId = newUser.user.id;
      }

      // 4. Link auth_user_id to the students record
      const { error: linkError } = await admin
        .from('students')
        .update({ auth_user_id: authUserId })
        .eq('id', student.id);

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully! Logging you in...',
      name: student.name,
    });
  } catch (err: any) {
    console.error('Activation error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
