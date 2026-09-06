create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sitter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sitter_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites" on public.favorites
  for select using (auth.uid() = user_id);

create policy "Users can add their own favorites" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "Users can remove their own favorites" on public.favorites
  for delete using (auth.uid() = user_id);
