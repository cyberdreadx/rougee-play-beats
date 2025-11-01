-- Create likes table for stories (idempotent)
create extension if not exists pgcrypto;

create table if not exists public.story_likes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  wallet_address text not null,
  created_at timestamptz not null default now(),
  constraint story_likes_unique unique (story_id, wallet_address)
);

create index if not exists story_likes_story_idx on public.story_likes (story_id);

alter table public.story_likes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_likes' and policyname = 'story_likes_select_all'
  ) then
    create policy story_likes_select_all on public.story_likes for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_likes' and policyname = 'story_likes_insert_any'
  ) then
    create policy story_likes_insert_any on public.story_likes for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_likes' and policyname = 'story_likes_delete_own'
  ) then
    create policy story_likes_delete_own on public.story_likes for delete using (true);
  end if;
end $$;


