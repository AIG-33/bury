-- Add updated_at + the shared set_updated_at() trigger to legacy tables that
-- were created without them (AGENTS.md §7 requires both on every table).
--
-- Also: store the Resend message id on notifications_outbox so the
-- /api/resend-webhook handler can correlate bounce/complaint events with
-- the outbox row that produced the email.
--
-- Forward-only. `create trigger` has no IF NOT EXISTS in Postgres, so each
-- trigger is dropped (if present) and recreated — idempotent on re-run.

alter table tournament_participants  add column if not exists updated_at timestamptz not null default now();
alter table rating_history           add column if not exists updated_at timestamptz not null default now();
alter table quiz_versions            add column if not exists updated_at timestamptz not null default now();
alter table quiz_questions           add column if not exists updated_at timestamptz not null default now();
alter table quiz_answers             add column if not exists updated_at timestamptz not null default now();
alter table rating_algorithm_config  add column if not exists updated_at timestamptz not null default now();
alter table notifications_outbox     add column if not exists updated_at timestamptz not null default now();
-- telegram_links / audit_log intentionally absent: both were dropped by
-- 20260514000100_db_audit_drop_dead_objects.sql; telegram_links is re-created
-- (with updated_at built in) by 20260611000300_restore_telegram_links.sql.
alter table open_match_applications  add column if not exists updated_at timestamptz not null default now();
alter table tournament_venues        add column if not exists updated_at timestamptz not null default now();
alter table external_rating_history  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_tournament_participants_updated on tournament_participants;
create trigger trg_tournament_participants_updated before update on tournament_participants for each row execute function set_updated_at();

drop trigger if exists trg_rating_history_updated on rating_history;
create trigger trg_rating_history_updated before update on rating_history for each row execute function set_updated_at();

drop trigger if exists trg_quiz_versions_updated on quiz_versions;
create trigger trg_quiz_versions_updated before update on quiz_versions for each row execute function set_updated_at();

drop trigger if exists trg_quiz_questions_updated on quiz_questions;
create trigger trg_quiz_questions_updated before update on quiz_questions for each row execute function set_updated_at();

drop trigger if exists trg_quiz_answers_updated on quiz_answers;
create trigger trg_quiz_answers_updated before update on quiz_answers for each row execute function set_updated_at();

drop trigger if exists trg_rating_algorithm_config_updated on rating_algorithm_config;
create trigger trg_rating_algorithm_config_updated before update on rating_algorithm_config for each row execute function set_updated_at();

drop trigger if exists trg_notifications_outbox_updated on notifications_outbox;
create trigger trg_notifications_outbox_updated before update on notifications_outbox for each row execute function set_updated_at();

drop trigger if exists trg_open_match_applications_updated on open_match_applications;
create trigger trg_open_match_applications_updated before update on open_match_applications for each row execute function set_updated_at();

drop trigger if exists trg_tournament_venues_updated on tournament_venues;
create trigger trg_tournament_venues_updated before update on tournament_venues for each row execute function set_updated_at();

drop trigger if exists trg_external_rating_history_updated on external_rating_history;
create trigger trg_external_rating_history_updated before update on external_rating_history for each row execute function set_updated_at();

-- Resend (provider) message id for webhook correlation.
alter table notifications_outbox add column if not exists provider_message_id text;
create index if not exists outbox_provider_message_id_idx
  on notifications_outbox (provider_message_id)
  where provider_message_id is not null;
