alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_lesson_completions enable row level security;
alter table public.mistakes enable row level security;

create policy "profiles are readable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are writable by owner"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "progress is owned by user"
  on public.user_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lesson completions are owned by user"
  on public.user_lesson_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "mistakes are owned by user"
  on public.mistakes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lesson catalog is public"
  on public.lessons for select
  using (true);

create policy "phrase catalog is public"
  on public.phrases for select
  using (true);

create policy "exercise catalog is public"
  on public.exercises for select
  using (true);
