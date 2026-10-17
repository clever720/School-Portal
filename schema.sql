
-- EduSphere School Portal
-- Run in the Supabase SQL Editor.
-- Review and test policies before using real student records.

create extension if not exists pgcrypto;

create type public.school_role as enum
  ('student', 'guardian', 'teacher', 'staff', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.school_role not null default 'student',
  created_at timestamptz not null default now()
);

create or replace function public.create_school_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_school on auth.users;
create trigger on_auth_user_created_school
after insert on auth.users
for each row execute function public.create_school_profile();

create or replace function public.current_school_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role::text
  from public.profiles
  where id = (select auth.uid())
$$;

create or replace function public.is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_school_role() in
    ('teacher', 'staff', 'admin'), false)
$$;

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_school_role() = 'admin', false)
$$;

-- Family-to-student relationship. Admins should maintain these links.
create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null default 'guardian',
  created_at timestamptz not null default now(),
  unique (guardian_id, student_id),
  check (guardian_id <> student_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'everyone'
    check (audience in ('everyone','students','guardians','staff')),
  priority text not null default 'normal'
    check (priority in ('normal','important','urgent')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  description text,
  term text,
  teacher_name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  instructions text,
  due_date date,
  max_score numeric(8,2) not null default 100
    check (max_score > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Student assignment submissions.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_text text,
  attachment_url text,
  status text not null default 'submitted'
    check (status in ('draft','submitted','graded','returned')),
  score numeric(8,2),
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  assessment text not null,
  score numeric(8,2) not null check (score >= 0),
  max_score numeric(8,2) not null default 100 check (max_score > 0),
  term text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (score <= max_score)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','excused')),
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  category text not null default 'general',
  message text not null,
  status text not null default 'pending'
    check (status in ('pending','in_progress','resolved','rejected')),
  staff_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_title text,
  email text,
  phone text,
  office text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Enable row-level security on every application table.
alter table public.profiles enable row level security;
alter table public.guardian_links enable row level security;
alter table public.announcements enable row level security;
alter table public.courses enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.grades enable row level security;
alter table public.attendance enable row level security;
alter table public.requests enable row level security;
alter table public.contacts enable row level security;

-- Profiles: users can read their own; admins can read all.
create policy "profiles_read_self_or_admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_school_admin());

-- No user-facing profile update policy: role changes are admin-controlled
-- through a trusted admin workflow / Supabase SQL Editor.

create policy "guardian_links_read_related_or_admin"
on public.guardian_links for select to authenticated
using (
  guardian_id = (select auth.uid())
  or student_id = (select auth.uid())
  or public.is_school_admin()
);

create policy "guardian_links_admin_insert"
on public.guardian_links for insert to authenticated
with check (public.is_school_admin());

create policy "guardian_links_admin_delete"
on public.guardian_links for delete to authenticated
using (public.is_school_admin());

create policy "announcements_read_authenticated"
on public.announcements for select to authenticated
using (
  audience = 'everyone'
  or (audience = 'students' and public.current_school_role() = 'student')
  or (audience = 'guardians' and public.current_school_role() = 'guardian')
  or (audience = 'staff' and public.is_school_staff())
);

create policy "announcements_staff_insert"
on public.announcements for insert to authenticated
with check (public.is_school_staff());

create policy "announcements_staff_update"
on public.announcements for update to authenticated
using (public.is_school_staff())
with check (public.is_school_staff());

create policy "announcements_admin_delete"
on public.announcements for delete to authenticated
using (public.is_school_admin());

create policy "courses_read_authenticated"
on public.courses for select to authenticated using (true);

create policy "courses_teacher_insert"
on public.courses for insert to authenticated
with check (public.current_school_role() in ('teacher','admin'));

create policy "courses_teacher_update"
on public.courses for update to authenticated
using (public.current_school_role() in ('teacher','admin'))
with check (public.current_school_role() in ('teacher','admin'));

create policy "courses_admin_delete"
on public.courses for delete to authenticated
using (public.is_school_admin());

create policy "assignments_read_authenticated"
on public.assignments for select to authenticated using (true);

create policy "assignments_teacher_insert"
on public.assignments for insert to authenticated
with check (public.current_school_role() in ('teacher','admin'));

create policy "assignments_teacher_update"
on public.assignments for update to authenticated
using (public.current_school_role() in ('teacher','admin'))
with check (public.current_school_role() in ('teacher','admin'));

create policy "assignments_admin_delete"
on public.assignments for delete to authenticated
using (public.is_school_admin());

create policy "submissions_student_or_staff_read"
on public.submissions for select to authenticated
using (
  student_id = (select auth.uid())
  or public.is_school_staff()
  or exists (
    select 1 from public.guardian_links gl
    where gl.guardian_id = (select auth.uid())
      and gl.student_id = submissions.student_id
  )
);

create policy "submissions_student_insert"
on public.submissions for insert to authenticated
with check (
  student_id = (select auth.uid())
  and public.current_school_role() = 'student'
);

create policy "submissions_student_update_own"
on public.submissions for update to authenticated
using (
  student_id = (select auth.uid())
  and status in ('draft','submitted')
)
with check (student_id = (select auth.uid()));

create policy "submissions_staff_grade"
on public.submissions for update to authenticated
using (public.is_school_staff())
with check (public.is_school_staff());

create policy "grades_read_own_guardian_or_staff"
on public.grades for select to authenticated
using (
  student_id = (select auth.uid())
  or public.is_school_staff()
  or exists (
    select 1 from public.guardian_links gl
    where gl.guardian_id = (select auth.uid())
      and gl.student_id = grades.student_id
  )
);

create policy "grades_staff_insert"
on public.grades for insert to authenticated
with check (public.current_school_role() in ('teacher','admin'));

create policy "grades_staff_update"
on public.grades for update to authenticated
using (public.current_school_role() in ('teacher','admin'))
with check (public.current_school_role() in ('teacher','admin'));

create policy "grades_admin_delete"
on public.grades for delete to authenticated
using (public.is_school_admin());

create policy "attendance_read_own_guardian_or_staff"
on public.attendance for select to authenticated
using (
  student_id = (select auth.uid())
  or public.is_school_staff()
  or exists (
    select 1 from public.guardian_links gl
    where gl.guardian_id = (select auth.uid())
      and gl.student_id = attendance.student_id
  )
);

create policy "attendance_staff_insert"
on public.attendance for insert to authenticated
with check (public.current_school_role() in ('teacher','admin'));

create policy "attendance_staff_update"
on public.attendance for update to authenticated
using (public.current_school_role() in ('teacher','admin'))
with check (public.current_school_role() in ('teacher','admin'));

create policy "attendance_admin_delete"
on public.attendance for delete to authenticated
using (public.is_school_admin());

create policy "requests_read_own_or_staff"
on public.requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or public.is_school_staff()
);

create policy "requests_insert_own"
on public.requests for insert to authenticated
with check (requester_id = (select auth.uid()));

create policy "requests_staff_update"
on public.requests for update to authenticated
using (public.is_school_staff())
with check (public.is_school_staff());

create policy "requests_admin_delete"
on public.requests for delete to authenticated
using (public.is_school_admin());

create policy "contacts_read_authenticated"
on public.contacts for select to authenticated using (true);

create policy "contacts_staff_insert"
on public.contacts for insert to authenticated
with check (public.current_school_role() in ('staff','admin'));

create policy "contacts_staff_update"
on public.contacts for update to authenticated
using (public.current_school_role() in ('staff','admin'))
with check (public.current_school_role() in ('staff','admin'));

create policy "contacts_admin_delete"
on public.contacts for delete to authenticated
using (public.is_school_admin());

-- Helpful indexes for common queries.
create index if not exists idx_announcements_created
  on public.announcements(created_at desc);
create index if not exists idx_assignments_due
  on public.assignments(due_date);
create index if not exists idx_grades_student
  on public.grades(student_id);
create index if not exists idx_attendance_student_date
  on public.attendance(student_id, attendance_date desc);
create index if not exists idx_requests_requester
  on public.requests(requester_id, created_at desc);
create index if not exists idx_guardian_links_guardian
  on public.guardian_links(guardian_id);
