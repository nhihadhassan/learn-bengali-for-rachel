create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id text primary key,
  title text not null,
  unit_number integer not null,
  difficulty text not null,
  summary text not null
);

create table public.phrases (
  id text primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  bengali text not null,
  english text not null,
  pronunciation text not null,
  category text not null
);

create table public.exercises (
  id text primary key,
  lesson_id text not null references public.lessons(id) on delete cascade,
  phrase_id text references public.phrases(id) on delete set null,
  type text not null check (type in ('multiple-choice', 'translation', 'matching')),
  prompt text not null,
  answer text not null,
  options jsonb,
  pairs jsonb
);

create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0,
  streak integer not null default 0,
  current_unit integer not null default 1,
  last_practice_date date,
  updated_at timestamptz not null default now()
);

create table public.user_lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  score integer not null default 0,
  primary key (user_id, lesson_id)
);

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  wrong_answer text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
