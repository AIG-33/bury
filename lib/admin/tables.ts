/**
 * Registry of database tables exposed to the in-app admin DB editor
 * (`/admin/db/...`).
 *
 * The registry doubles as a security whitelist: server actions that perform
 * CRUD on behalf of an admin will refuse any table name not present here.
 * Never accept arbitrary table names from the client.
 *
 * Column types map to:
 *   - the form input rendered by `<RowForm/>`
 *   - the list cell rendered by `<RowsTable/>`
 *   - the value coercion done in `coerceFormValue()` before insert/update
 */

export type ColumnType =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "uuid"
  | "json"
  | "select";

export type ColumnDef = {
  /** DB column name. */
  key: string;
  /** Human-friendly label shown in headers and forms. */
  label: string;
  type: ColumnType;
  /** Required values for `select` type. */
  options?: readonly string[];
  /** Required on insert (form will refuse to submit without a value). */
  required?: boolean;
  /** Cannot be modified through the editor at all (system / generated). */
  readonly?: boolean;
  /** Hide from the list (table) view but still editable in forms. */
  hideInList?: boolean;
  /** Hide from forms entirely (e.g. computed columns). */
  hideInForm?: boolean;
  /** Tailwind width class for the list column header. */
  width?: string;
  /** Help text shown under the form input. */
  hint?: string;
};

export type TableDef = {
  /** Postgres table name; also the URL slug. */
  name: string;
  /** Human-friendly title. */
  label: string;
  /** Group used to bucket cards on the index page. */
  group: "people" | "venues" | "play" | "config" | "ops";
  /** PK column. Always `id` in this schema. */
  pk: string;
  /** Default sort applied to the list view. */
  defaultSort: { column: string; ascending: boolean };
  /** Columns to ILIKE %q% when the user types in the search box. */
  searchColumns: readonly string[];
  /** Columns that may be filtered exactly via a per-column control. */
  filterColumns?: readonly string[];
  /** Short description for the index card. */
  description: string;
  columns: readonly ColumnDef[];
  /** Disable the "New row" button (rows are created elsewhere, e.g. by a trigger). */
  disableInsert?: boolean;
  /**
   * For `profiles`: deleting the row also removes the corresponding
   * `auth.users` record (which then CASCADEs back to profiles). Other
   * tables ignore this flag.
   */
  deleteAlsoAuthUser?: boolean;
  /** Extra confirmation message shown before deletion (i18n key under adminDb.delete_warnings). */
  destructiveHint?: string;
};

const META_COLUMNS: readonly ColumnDef[] = [
  { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
  { key: "created_at", label: "Created", type: "datetime", readonly: true, hideInList: true },
  { key: "updated_at", label: "Updated", type: "datetime", readonly: true, hideInList: true },
];

export const TABLES: readonly TableDef[] = [
  // ---------------------------------------------------------------------------
  // PEOPLE
  // ---------------------------------------------------------------------------
  {
    name: "profiles",
    label: "Profiles",
    group: "people",
    pk: "id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: ["display_name", "email_local", "first_name", "last_name", "city", "coach_slug"],
    filterColumns: ["is_admin", "is_coach", "is_player", "country", "locale"],
    description: "Players, coaches and admins. Edit roles, contacts, ratings and visibility.",
    // New profiles are auto-created by the auth.users insert trigger.
    disableInsert: true,
    // Deletion also removes the auth.users row (CASCADEs back to profiles).
    deleteAlsoAuthUser: true,
    destructiveHint: "profiles_delete",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "display_name", label: "Display name", type: "text", readonly: true, hint: "Generated from first/last/email" },
      { key: "first_name", label: "First name", type: "text" },
      { key: "last_name", label: "Last name", type: "text" },
      { key: "email_local", label: "Email local", type: "text" },
      { key: "is_admin", label: "Admin", type: "boolean" },
      { key: "is_coach", label: "Coach", type: "boolean" },
      { key: "is_player", label: "Player", type: "boolean" },
      { key: "phone", label: "Phone", type: "text", hideInList: true },
      { key: "whatsapp", label: "WhatsApp", type: "text", hideInList: true },
      { key: "telegram_username", label: "Telegram", type: "text", hideInList: true },
      { key: "country", label: "Country", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "district_id", label: "District", type: "uuid", hideInList: true },
      { key: "current_elo", label: "Elo", type: "number" },
      {
        key: "elo_status",
        label: "Elo status",
        type: "select",
        options: ["provisional", "established"],
      },
      { key: "rated_matches_count", label: "Rated", type: "number", hideInList: true },
      { key: "coach_slug", label: "Coach slug", type: "text", hideInList: true },
      { key: "coach_bio", label: "Coach bio", type: "textarea", hideInList: true },
      { key: "coach_hourly_rate_pln", label: "Hourly PLN", type: "number", hideInList: true },
      { key: "visible_in_find_player", label: "In find-player", type: "boolean", hideInList: true },
      { key: "visible_in_leaderboard", label: "In leaderboard", type: "boolean", hideInList: true },
      { key: "notification_email", label: "Notif email", type: "boolean", hideInList: true },
      { key: "notification_telegram", label: "Notif TG", type: "boolean", hideInList: true },
      {
        key: "locale",
        label: "Locale",
        type: "select",
        options: ["pl", "en", "ru"],
      },
      { key: "timezone", label: "Timezone", type: "text", hideInList: true },
      { key: "social_links", label: "Social links", type: "json", hideInList: true },
      { key: "availability", label: "Availability", type: "json", hideInList: true },
      { key: "coach_certifications", label: "Certifications", type: "json", hideInList: true },
      { key: "created_at", label: "Created", type: "datetime", readonly: true },
      { key: "updated_at", label: "Updated", type: "datetime", readonly: true, hideInList: true },
    ],
  },
  {
    name: "telegram_links",
    label: "Telegram links",
    group: "people",
    pk: "id",
    defaultSort: { column: "linked_at", ascending: false },
    searchColumns: ["player_id"],
    description: "Linked Telegram accounts (player ↔ chat_id).",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true },
      { key: "player_id", label: "Player", type: "uuid", required: true },
      { key: "chat_id", label: "Chat ID", type: "number", required: true },
      { key: "link_token", label: "Token", type: "text", hideInList: true },
      { key: "linked_at", label: "Linked", type: "datetime", readonly: true },
    ],
  },

  // ---------------------------------------------------------------------------
  // VENUES & DISTRICTS
  // ---------------------------------------------------------------------------
  {
    name: "districts",
    label: "Districts",
    group: "venues",
    pk: "id",
    defaultSort: { column: "city", ascending: true },
    searchColumns: ["city", "name", "slug"],
    filterColumns: ["country"],
    description: "City districts used for player & coach geolocation.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "country", label: "Country", type: "text", required: true },
      { key: "city", label: "City", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "lat", label: "Lat", type: "decimal" },
      { key: "lng", label: "Lng", type: "decimal" },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "clubs",
    label: "Clubs",
    group: "venues",
    pk: "id",
    defaultSort: { column: "name", ascending: true },
    searchColumns: ["name", "slug"],
    description: "Tennis clubs with an owning coach.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "owner_id", label: "Owner", type: "uuid", required: true },
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea", hideInList: true },
      { key: "logo_url", label: "Logo URL", type: "text", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "venues",
    label: "Venues",
    group: "venues",
    pk: "id",
    defaultSort: { column: "name", ascending: true },
    searchColumns: ["name", "address", "city"],
    filterColumns: ["is_indoor"],
    description: "Physical locations with courts.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "owner_id", label: "Owner", type: "uuid", required: true },
      { key: "club_id", label: "Club", type: "uuid" },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "address", label: "Address", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "district_id", label: "District", type: "uuid" },
      { key: "lat", label: "Lat", type: "decimal", hideInList: true },
      { key: "lng", label: "Lng", type: "decimal", hideInList: true },
      { key: "is_indoor", label: "Indoor", type: "boolean" },
      { key: "amenities", label: "Amenities", type: "json", hideInList: true },
      { key: "photos", label: "Photos", type: "json", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "courts",
    label: "Courts",
    group: "venues",
    pk: "id",
    defaultSort: { column: "number", ascending: true },
    searchColumns: ["name"],
    filterColumns: ["surface", "status"],
    description: "Courts inside venues.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "venue_id", label: "Venue", type: "uuid", required: true },
      { key: "number", label: "Number", type: "number", required: true },
      { key: "name", label: "Name", type: "text" },
      {
        key: "surface",
        label: "Surface",
        type: "select",
        options: ["hard", "clay", "grass", "carpet"],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["active", "maintenance"],
      },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "slot_templates",
    label: "Slot templates",
    group: "venues",
    pk: "id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: ["notes"],
    filterColumns: ["slot_type", "active"],
    description: "Repeating coach availability rules (RRULE).",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "court_id", label: "Court", type: "uuid", required: true },
      { key: "owner_id", label: "Owner", type: "uuid", required: true },
      { key: "rrule", label: "RRULE", type: "text", required: true, hint: "iCal RRULE expression" },
      { key: "start_time", label: "Start time", type: "text", required: true, hint: "HH:MM" },
      { key: "duration_minutes", label: "Duration (min)", type: "number", required: true },
      {
        key: "slot_type",
        label: "Type",
        type: "select",
        options: ["individual", "pair", "group"],
      },
      { key: "max_participants", label: "Max", type: "number" },
      { key: "price_pln", label: "Price PLN", type: "number" },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
      { key: "exception_dates", label: "Exception dates", type: "json", hideInList: true },
      { key: "active", label: "Active", type: "boolean" },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "slots",
    label: "Slots",
    group: "venues",
    pk: "id",
    defaultSort: { column: "starts_at", ascending: false },
    searchColumns: ["notes"],
    filterColumns: ["status", "slot_type"],
    description: "Materialized slot occurrences bookable by players.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "court_id", label: "Court", type: "uuid", required: true },
      { key: "template_id", label: "Template", type: "uuid", hideInList: true },
      { key: "owner_id", label: "Owner", type: "uuid", required: true },
      { key: "starts_at", label: "Starts", type: "datetime", required: true },
      { key: "ends_at", label: "Ends", type: "datetime", required: true },
      {
        key: "slot_type",
        label: "Type",
        type: "select",
        options: ["individual", "pair", "group"],
      },
      { key: "max_participants", label: "Max", type: "number" },
      { key: "price_pln", label: "Price PLN", type: "number" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["open", "closed", "cancelled"],
      },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },

  // ---------------------------------------------------------------------------
  // PLAY
  // ---------------------------------------------------------------------------
  {
    name: "bookings",
    label: "Bookings",
    group: "play",
    pk: "id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: ["notes", "cancel_reason"],
    filterColumns: ["status", "paid_status"],
    description: "Player → coach lesson bookings.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "slot_id", label: "Slot", type: "uuid", required: true },
      { key: "player_id", label: "Player", type: "uuid", required: true },
      { key: "coach_id", label: "Coach", type: "uuid", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["pending", "confirmed", "cancelled", "attended", "no_show"],
      },
      {
        key: "paid_status",
        label: "Paid",
        type: "select",
        options: ["unpaid", "paid", "comped"],
      },
      { key: "cancel_reason", label: "Cancel reason", type: "text", hideInList: true },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "tournaments",
    label: "Tournaments",
    group: "play",
    pk: "id",
    defaultSort: { column: "starts_on", ascending: false },
    searchColumns: ["name", "description"],
    filterColumns: ["status", "format", "privacy", "surface"],
    description: "Tournament definitions.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "owner_coach_id", label: "Owner coach", type: "uuid", required: true },
      { key: "club_id", label: "Club", type: "uuid", hideInList: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea", hideInList: true },
      {
        key: "format",
        label: "Format",
        type: "select",
        required: true,
        options: [
          "single_elimination",
          "double_elimination",
          "round_robin",
          "group_playoff",
          "swiss",
          "compass",
        ],
      },
      { key: "match_rules", label: "Match rules", type: "json", required: true, hideInList: true },
      { key: "scoring_rules", label: "Scoring rules", type: "json", hideInList: true },
      {
        key: "surface",
        label: "Surface",
        type: "select",
        options: ["hard", "clay", "grass", "carpet"],
      },
      { key: "starts_on", label: "Starts", type: "date", required: true },
      { key: "start_time", label: "Start time", type: "text" },
      { key: "ends_on", label: "Ends", type: "date" },
      { key: "registration_deadline", label: "Reg deadline", type: "datetime", hideInList: true },
      { key: "max_participants", label: "Max", type: "number", hideInList: true },
      { key: "entry_fee_pln", label: "Entry fee (PLN)", type: "number" },
      {
        key: "privacy",
        label: "Privacy",
        type: "select",
        options: ["club", "public"],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["draft", "registration", "in_progress", "finished", "cancelled"],
      },
      {
        key: "draw_method",
        label: "Draw",
        type: "select",
        options: ["rating", "random", "manual", "hybrid"],
        hideInList: true,
      },
      { key: "prizes_description", label: "Prizes", type: "textarea", hideInList: true },
      { key: "cover_url", label: "Cover URL", type: "text", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "tournament_participants",
    label: "Tournament participants",
    group: "play",
    pk: "id",
    defaultSort: { column: "registered_at", ascending: false },
    searchColumns: [],
    filterColumns: ["withdrawn"],
    description: "Player ↔ tournament registrations.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "tournament_id", label: "Tournament", type: "uuid", required: true },
      { key: "player_id", label: "Player", type: "uuid", required: true },
      { key: "partner_id", label: "Partner", type: "uuid", hideInList: true },
      { key: "seed", label: "Seed", type: "number" },
      { key: "withdrawn", label: "Withdrawn", type: "boolean" },
      { key: "registered_at", label: "Registered", type: "datetime", readonly: true },
    ],
  },
  {
    name: "tournament_venues",
    label: "Tournament venues",
    group: "play",
    pk: "tournament_id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: [],
    filterColumns: [],
    description:
      "Junction: a tournament may use multiple venues. Composite PK (tournament_id, venue_id).",
    columns: [
      { key: "tournament_id", label: "Tournament", type: "uuid", required: true },
      { key: "venue_id", label: "Venue", type: "uuid", required: true },
      { key: "created_at", label: "Linked at", type: "datetime", readonly: true },
    ],
  },
  {
    name: "matches",
    label: "Matches",
    group: "play",
    pk: "id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: ["notes"],
    filterColumns: ["outcome", "is_doubles"],
    description: "Friendly + tournament matches. Editing here will NOT recalc Elo automatically.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "tournament_id", label: "Tournament", type: "uuid", hideInList: true },
      { key: "round", label: "Round", type: "number" },
      { key: "bracket_slot", label: "Slot", type: "number", hideInList: true },
      {
        key: "bracket_side",
        label: "Side",
        type: "select",
        options: ["main", "losers", "east", "west", "north", "south"],
        hideInList: true,
      },
      { key: "is_doubles", label: "Doubles", type: "boolean" },
      { key: "p1_id", label: "P1", type: "uuid", required: true },
      { key: "p1_partner_id", label: "P1 partner", type: "uuid", hideInList: true },
      { key: "p2_id", label: "P2", type: "uuid" },
      { key: "p2_partner_id", label: "P2 partner", type: "uuid", hideInList: true },
      {
        key: "winner_side",
        label: "Winner",
        type: "select",
        options: ["p1", "p2"],
      },
      {
        key: "outcome",
        label: "Outcome",
        type: "select",
        options: [
          "pending",
          "proposed",
          "scheduled",
          "completed",
          "walkover_p1",
          "walkover_p2",
          "retired_p1",
          "retired_p2",
          "dsq_p1",
          "dsq_p2",
          "cancelled",
        ],
      },
      { key: "match_rules", label: "Match rules", type: "json", hideInList: true },
      { key: "sets", label: "Sets", type: "json", hideInList: true },
      { key: "scheduled_at", label: "Scheduled", type: "datetime", hideInList: true },
      { key: "played_at", label: "Played", type: "datetime" },
      { key: "court_id", label: "Court", type: "uuid", hideInList: true },
      { key: "multiplier", label: "Mult", type: "decimal", hideInList: true },
      { key: "confirmed_by_p1", label: "Conf P1", type: "boolean", hideInList: true },
      { key: "confirmed_by_p2", label: "Conf P2", type: "boolean", hideInList: true },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "coach_reviews",
    label: "Coach reviews",
    group: "play",
    pk: "id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: ["text", "coach_reply", "flagged_reason"],
    filterColumns: ["status", "stars", "source_type"],
    description: "Player reviews of coaches with moderation status.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "reviewer_id", label: "Reviewer", type: "uuid", required: true },
      { key: "target_coach_id", label: "Coach", type: "uuid", required: true },
      {
        key: "source_type",
        label: "Source",
        type: "select",
        required: true,
        options: ["booking", "match", "manual"],
      },
      { key: "source_id", label: "Source ID", type: "uuid", hideInList: true },
      { key: "stars", label: "Stars", type: "number", required: true },
      { key: "categories", label: "Categories", type: "json", hideInList: true },
      { key: "text", label: "Text", type: "textarea", hideInList: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["published", "hidden", "flagged", "removed"],
      },
      { key: "coach_reply", label: "Coach reply", type: "textarea", hideInList: true },
      { key: "flagged_reason", label: "Flag reason", type: "text", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------
  {
    name: "quiz_versions",
    label: "Quiz versions",
    group: "config",
    pk: "id",
    defaultSort: { column: "version", ascending: false },
    searchColumns: ["notes"],
    filterColumns: ["is_active"],
    description: "Versions of the onboarding quiz. Use the dedicated /admin/quiz editor for question editing.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "version", label: "Version", type: "number", required: true },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
      { key: "created_by", label: "Created by", type: "uuid", hideInList: true },
      { key: "created_at", label: "Created", type: "datetime", readonly: true },
    ],
  },
  {
    name: "rating_algorithm_config",
    label: "Rating algorithm config",
    group: "config",
    pk: "id",
    defaultSort: { column: "version", ascending: false },
    searchColumns: ["notes"],
    filterColumns: ["is_active"],
    description: "Versioned Elo / multiplier configuration. Use /admin/rating for the structured editor.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "version", label: "Version", type: "number", required: true },
      { key: "is_active", label: "Active", type: "boolean" },
      { key: "config", label: "Config (JSON)", type: "json", required: true, hideInList: true },
      { key: "notes", label: "Notes", type: "textarea", hideInList: true },
      { key: "created_by", label: "Created by", type: "uuid", hideInList: true },
      { key: "created_at", label: "Created", type: "datetime", readonly: true },
    ],
  },
  {
    name: "seasons",
    label: "Seasons",
    group: "config",
    pk: "id",
    defaultSort: { column: "starts_on", ascending: false },
    searchColumns: ["name"],
    filterColumns: ["status"],
    description: "Season ladders (race-to-the-top scoring).",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "starts_on", label: "Starts", type: "date", required: true },
      { key: "ends_on", label: "Ends", type: "date", required: true },
      { key: "scoring", label: "Scoring", type: "json", required: true, hideInList: true },
      { key: "top_n_for_prizes", label: "Top N", type: "number" },
      { key: "prizes_description", label: "Prizes", type: "textarea", hideInList: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["upcoming", "active", "closed"],
      },
      { key: "winners", label: "Winners", type: "json", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },

  // ---------------------------------------------------------------------------
  // OPS
  // ---------------------------------------------------------------------------
  {
    name: "invitations",
    label: "Invitations",
    group: "ops",
    pk: "id",
    defaultSort: { column: "created_at", ascending: false },
    searchColumns: ["email", "first_name", "last_name"],
    filterColumns: ["status"],
    description: "Coach-issued invitation tokens.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "coach_id", label: "Coach", type: "uuid", required: true },
      { key: "email", label: "Email", type: "text", required: true },
      { key: "first_name", label: "First name", type: "text" },
      { key: "last_name", label: "Last name", type: "text" },
      { key: "phone", label: "Phone", type: "text", hideInList: true },
      { key: "token_hash", label: "Token hash", type: "text", required: true, hideInList: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["pending", "accepted", "expired", "revoked"],
      },
      { key: "expires_at", label: "Expires", type: "datetime", required: true },
      { key: "accepted_by", label: "Accepted by", type: "uuid", hideInList: true },
      { key: "accepted_at", label: "Accepted", type: "datetime", hideInList: true },
      ...META_COLUMNS.slice(1),
    ],
  },
  {
    name: "notifications_outbox",
    label: "Notifications outbox",
    group: "ops",
    pk: "id",
    defaultSort: { column: "scheduled_at", ascending: false },
    searchColumns: ["template", "last_error"],
    filterColumns: ["status", "channel", "locale"],
    description: "Pending / sent / failed email & telegram notifications.",
    columns: [
      { key: "id", label: "ID", type: "uuid", readonly: true, hideInList: true },
      { key: "recipient_id", label: "Recipient", type: "uuid", required: true },
      {
        key: "channel",
        label: "Channel",
        type: "select",
        required: true,
        options: ["email", "telegram"],
      },
      { key: "template", label: "Template", type: "text", required: true },
      {
        key: "locale",
        label: "Locale",
        type: "select",
        required: true,
        options: ["pl", "en", "ru"],
      },
      { key: "payload", label: "Payload", type: "json", hideInList: true },
      { key: "scheduled_at", label: "Scheduled", type: "datetime" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["pending", "sent", "failed", "cancelled"],
      },
      { key: "attempts", label: "Attempts", type: "number" },
      { key: "last_error", label: "Last error", type: "textarea", hideInList: true },
      { key: "sent_at", label: "Sent", type: "datetime", hideInList: true },
      { key: "created_at", label: "Created", type: "datetime", readonly: true, hideInList: true },
    ],
  },
] as const;

const TABLE_INDEX = new Map<string, TableDef>(TABLES.map((t) => [t.name, t]));

export function getTable(name: string): TableDef | null {
  return TABLE_INDEX.get(name) ?? null;
}

export function listTablesByGroup(): Array<{ group: TableDef["group"]; tables: TableDef[] }> {
  const byGroup = new Map<TableDef["group"], TableDef[]>();
  for (const t of TABLES) {
    const arr = byGroup.get(t.group) ?? [];
    arr.push(t as TableDef);
    byGroup.set(t.group, arr);
  }
  const order: TableDef["group"][] = ["people", "venues", "play", "config", "ops"];
  return order
    .filter((g) => byGroup.has(g))
    .map((g) => ({ group: g, tables: byGroup.get(g)! }));
}

export function listColumnsForList(t: TableDef): ColumnDef[] {
  return t.columns.filter((c) => !c.hideInList);
}

export function listColumnsForForm(t: TableDef): ColumnDef[] {
  return t.columns.filter((c) => !c.hideInForm);
}
