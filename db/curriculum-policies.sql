-- Curriculum catalog is public reference data: readable by everyone, never
-- written by end users (the seed process writes it with the service role).

alter table public.curriculum_courses enable row level security;
alter table public.curriculum_sections enable row level security;
alter table public.curriculum_units enable row level security;
alter table public.curriculum_vocabulary_items enable row level security;
alter table public.curriculum_phrase_patterns enable row level security;
alter table public.curriculum_lessons enable row level security;
alter table public.curriculum_generated_exercises enable row level security;

create policy "curriculum courses are public"
  on public.curriculum_courses for select using (true);

create policy "curriculum sections are public"
  on public.curriculum_sections for select using (true);

create policy "curriculum units are public"
  on public.curriculum_units for select using (true);

create policy "curriculum vocabulary is public"
  on public.curriculum_vocabulary_items for select using (true);

create policy "curriculum phrases are public"
  on public.curriculum_phrase_patterns for select using (true);

create policy "curriculum lessons are public"
  on public.curriculum_lessons for select using (true);

create policy "curriculum exercises are public"
  on public.curriculum_generated_exercises for select using (true);
