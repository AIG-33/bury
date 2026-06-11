-- ============================================================
-- Restore `telegram_links`.
--
-- 20260514000100_db_audit_drop_dead_objects.sql dropped the table as a
-- placeholder for an unbuilt feature — but the Telegram integration was
-- built afterwards on top of it and the table was never re-created:
--   * /api/telegram/webhook upserts (player_id, chat_id) on /start;
--   * lib/notifications/outbox.ts + me/find actions read chat_id to send;
--   * /me/profile shows the linked/unlinked state.
-- Without this table every Telegram linking flow fails at runtime.
--
-- Mirrors the original definition (unique player, unique chat) minus the
-- never-used link_token column (tokens are stateless HMAC now), plus the
-- standard created_at/updated_at pair per AGENTS.md §7.
-- ============================================================

create table if not exists public.telegram_links (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null unique references public.profiles(id) on delete cascade,
  chat_id     bigint not null unique,
  linked_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.telegram_links enable row level security;

-- Owner (or admin) can see and manage their own link; webhook writes go
-- through the service role and bypass RLS.
drop policy if exists tg_links_self on public.telegram_links;
create policy tg_links_self on public.telegram_links
  for all
  using (player_id = auth.uid() or is_admin())
  with check (player_id = auth.uid() or is_admin());

drop trigger if exists trg_telegram_links_updated on public.telegram_links;
create trigger trg_telegram_links_updated
  before update on public.telegram_links
  for each row execute function set_updated_at();
