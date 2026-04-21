-- =============================================================================
-- WhatsApp as primary messenger (Poland-focused).
-- Adds notification_whatsapp; keeps notification_telegram/telegram_username
-- intact for backward compatibility (secondary, optional channel).
-- =============================================================================

alter table public.profiles
  add column if not exists notification_whatsapp boolean not null default true;

comment on column public.profiles.notification_whatsapp is
  'Primary messenger notifications (WhatsApp). Notifications are sent via Email until WhatsApp Business API is wired in Phase 2; this flag will then control delivery.';

comment on column public.profiles.whatsapp is
  'WhatsApp phone number in international format (E.164-ish). Primary contact channel for player↔player and player↔coach communication.';

comment on column public.profiles.telegram_username is
  'Optional secondary messenger. Telegram bot is used for some automated notifications when notification_telegram = true.';
