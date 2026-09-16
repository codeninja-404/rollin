-- Rollin — Initial Schema Migration
-- Run via: supabase db push

-- Enable pgcrypto
create extension if not exists pgcrypto;

-- ============================================================
-- STUDENTS
-- ============================================================
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  student_code text unique not null,
  name text not null,
  email text unique not null,
  department text,
  semester int,
  section text,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CLASSES
-- ============================================================
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  name text not null,
  department text,
  semester int,
  section text,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CLASS STUDENTS (junction)
-- ============================================================
create table if not exists class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  status text default 'active',
  created_at timestamptz default now(),
  unique(class_id, student_id)
);

-- ============================================================
-- ATTENDANCE SESSIONS
-- ============================================================
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  otp_secret text not null,
  status text default 'open' check (status in ('open','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references attendance_sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  marked_at timestamptz default now(),
  ip_address text,
  user_agent text,
  status text default 'present',
  created_at timestamptz default now(),
  unique(session_id, student_id)
);

-- ============================================================
-- CAMPUS NETWORKS
-- ============================================================
create table if not exists campus_networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cidr text not null,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  ip_address text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- ADMIN USERS
-- ============================================================
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text,
  email text,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_students_auth_user on students(auth_user_id);
create index if not exists idx_class_students_class on class_students(class_id);
create index if not exists idx_class_students_student on class_students(student_id);
create index if not exists idx_sessions_class on attendance_sessions(class_id);
create index if not exists idx_sessions_status on attendance_sessions(status);
create index if not exists idx_attendance_session on attendance(session_id);
create index if not exists idx_attendance_student on attendance(student_id);
create index if not exists idx_admin_auth on admin_users(auth_user_id);
create index if not exists idx_audit_created on audit_logs(created_at desc);

-- ============================================================
-- REALTIME PUBLICATION
-- Enable realtime for session + attendance tables
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'attendance_sessions'
  ) then
    alter publication supabase_realtime add table attendance_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table attendance;
  end if;
end $$;
