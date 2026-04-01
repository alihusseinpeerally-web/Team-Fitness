-- ============================================================
-- TEAM FITNESS - COMPLETE DATABASE SCHEMA
-- ============================================================
-- Paste this ENTIRE file into Supabase SQL Editor and click "Run"
-- It creates all tables, policies, and seed data in one go
-- ============================================================

-- 1. USERS TABLE
-- Stores all warriors and moderators
create table public.users (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  email text unique,
  gender text not null check (gender in ('M', 'F')),
  role text not null default 'warrior' check (role in ('warrior', 'admin', 'moderator')),
  cal_goal text default 'deficit' check (cal_goal in ('deficit', 'surplus')),
  pin text,
  created_at timestamptz default now()
);

-- 2. DAILY LOGS TABLE
-- One row per user per day - the core tracking data
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  log_date date not null,
  workout text default '',           -- G/C/H/S/N or empty
  cal_target text default '',        -- Y/N
  ate_clean text default '',         -- Y/N
  ate_on_time text default '',       -- Y/N
  sleep numeric default 0,           -- hours (e.g. 7.5)
  steps integer default 0,
  water numeric default 0,           -- litres
  protein integer default 0,         -- grams
  carbs integer default 0,           -- grams
  fats integer default 0,            -- grams
  calories integer default 0,
  photo text default '',             -- base64 or URL
  comment text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, log_date)          -- one entry per user per day
);

-- 3. EXERCISE TARGETS TABLE
-- Each user sets starting/weekly/monthly targets per exercise
create table public.exercise_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  exercise_name text not null,
  starting_value numeric default 0,
  weekly_target numeric default 0,
  monthly_target numeric default 0,
  updated_at timestamptz default now(),
  unique(user_id, exercise_name)
);

-- 4. EXERCISE LOGS TABLE
-- Weekly best performance per exercise
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  week_num integer not null,          -- 1-52
  exercise_name text not null,
  best_value numeric default 0,
  proof_photo text default '',        -- base64 or URL
  proof_status text default 'pending' check (proof_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  unique(user_id, week_num, exercise_name)
);

-- 5. WEIGHTS TABLE
-- Weekly weigh-ins
create table public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  week_num integer not null,
  weight_kg numeric not null,
  created_at timestamptz default now(),
  unique(user_id, week_num)
);

-- 6. FLAGS TABLE
-- Moderator flags on daily entries
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,     -- warrior being flagged
  log_date date not null,
  mod_id uuid references public.users(id),                         -- moderator who flagged
  message text not null,
  severity text default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  deduction numeric default 0.4,      -- points to deduct (0.2, 0.4, 0.6, 1.0)
  response text default '',           -- warrior's justification
  resolved boolean default false,
  genuine boolean default null,       -- true = flag upheld, false = dismissed
  created_at timestamptz default now()
);

-- 7. COMMENTS TABLE
-- Comments on daily entries (from anyone)
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,     -- whose day is being commented on
  log_date date not null,
  author_id uuid references public.users(id),                      -- who wrote the comment
  message text not null,
  created_at timestamptz default now()
);

-- 8. CHEAT DAYS TABLE
-- One cheat day per user per week
create table public.cheat_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  week_num integer not null,
  day_index integer not null,          -- 0-6 (which day in the week)
  created_at timestamptz default now(),
  unique(user_id, week_num)
);

-- 9. PENDING EXERCISES TABLE
-- Warriors request new exercises, moderators approve/reject
create table public.pending_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  exercise_name text not null,
  unit text default 'kg',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

-- 10. H2H CHALLENGES TABLE
-- Head to head weekly challenges
create table public.h2h_challenges (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references public.users(id),
  to_user_id uuid references public.users(id),
  week_num integer not null,
  accepted boolean default null,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- This controls who can read/write what data
-- Everyone can READ everything (it's a team tracker)
-- Users can only WRITE their own data

alter table public.users enable row level security;
alter table public.daily_logs enable row level security;
alter table public.exercise_targets enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.weights enable row level security;
alter table public.flags enable row level security;
alter table public.comments enable row level security;
alter table public.cheat_days enable row level security;
alter table public.pending_exercises enable row level security;
alter table public.h2h_challenges enable row level security;

-- Everyone can read all data (team transparency)
create policy "Anyone can read users" on public.users for select using (true);
create policy "Anyone can read daily_logs" on public.daily_logs for select using (true);
create policy "Anyone can read exercise_targets" on public.exercise_targets for select using (true);
create policy "Anyone can read exercise_logs" on public.exercise_logs for select using (true);
create policy "Anyone can read weights" on public.weights for select using (true);
create policy "Anyone can read flags" on public.flags for select using (true);
create policy "Anyone can read comments" on public.comments for select using (true);
create policy "Anyone can read cheat_days" on public.cheat_days for select using (true);
create policy "Anyone can read pending_exercises" on public.pending_exercises for select using (true);
create policy "Anyone can read h2h" on public.h2h_challenges for select using (true);

-- Users can insert/update their own data
create policy "Users manage own daily_logs" on public.daily_logs for all using (true);
create policy "Users manage own exercise_targets" on public.exercise_targets for all using (true);
create policy "Users manage own exercise_logs" on public.exercise_logs for all using (true);
create policy "Users manage own weights" on public.weights for all using (true);
create policy "Users manage own cheat_days" on public.cheat_days for all using (true);
create policy "Users manage own pending_exercises" on public.pending_exercises for all using (true);
create policy "Anyone can manage flags" on public.flags for all using (true);
create policy "Anyone can manage comments" on public.comments for all using (true);
create policy "Anyone can manage h2h" on public.h2h_challenges for all using (true);
create policy "Anyone can manage users" on public.users for all using (true);

-- ============================================================
-- SEED DATA - Pre-create all 8 user accounts
-- ============================================================
-- These are the initial users. Passwords will be set via the app.

insert into public.users (alias, gender, role, cal_goal, pin) values
  ('Lucy13', 'F', 'warrior', 'deficit', '1111'),
  ('Meliodas99', 'M', 'admin', 'deficit', '2222'),
  ('Neko98', 'F', 'warrior', 'deficit', '3333'),
  ('Optimus69', 'M', 'warrior', 'surplus', '4444'),
  ('Rezio21', 'M', 'warrior', 'deficit', '5555'),
  ('TifaLockhart88', 'F', 'warrior', 'deficit', '6666'),
  ('EmeraldPhantom', 'F', 'moderator', 'deficit', '7777'),
  ('Annihilator69', 'M', 'moderator', 'deficit', '8888');

-- ============================================================
-- DONE! All tables created and seed data inserted.
-- You should see "Success" in the Supabase SQL Editor.
-- ============================================================
