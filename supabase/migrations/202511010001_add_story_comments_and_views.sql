-- Create story_comments (if missing) for story comment threads
create extension if not exists pgcrypto;

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  wallet_address text not null,
  comment_text text not null,
  created_at timestamptz not null default now()
);

-- If table already existed, ensure created_at column exists
alter table public.story_comments add column if not exists created_at timestamptz not null default now();

create index if not exists story_comments_story_created_idx on public.story_comments (story_id, created_at);

alter table public.story_comments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_comments' and policyname = 'story_comments_select_all'
  ) then
    create policy story_comments_select_all on public.story_comments for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_comments' and policyname = 'story_comments_insert_any'
  ) then
    create policy story_comments_insert_any on public.story_comments for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_comments' and policyname = 'story_comments_delete_any'
  ) then
    create policy story_comments_delete_any on public.story_comments for delete using (true);
  end if;
end $$;

-- Ensure story_views exists and supports unique per viewer per story
create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_wallet_address text not null,
  created_at timestamptz not null default now()
);

-- If table already existed, ensure created_at column exists
alter table public.story_views add column if not exists created_at timestamptz not null default now();

-- Ensure unique constraint exists
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'story_views_unique_view'
  ) then
    alter table public.story_views add constraint story_views_unique_view unique (story_id, viewer_wallet_address);
  end if;
end $$;

create index if not exists story_views_story_created_idx on public.story_views (story_id, created_at);

alter table public.story_views enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_views' and policyname = 'story_views_select_all'
  ) then
    create policy story_views_select_all on public.story_views for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'story_views' and policyname = 'story_views_insert_any'
  ) then
    create policy story_views_insert_any on public.story_views for insert with check (true);
  end if;
end $$;


