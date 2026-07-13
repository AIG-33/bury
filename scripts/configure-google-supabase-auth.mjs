#!/usr/bin/env node
/**
 * Applies Google OAuth provider settings to the hosted Supabase project via the
 * Management API. Requires SUPABASE_ACCESS_TOKEN (sbp_…) from the dashboard.
 *
 * Reads the Web client secret from .secrets/google-web-client-secret.txt
 * (GOCSPX-… downloaded from Google Cloud Console). Never commit secrets.
 *
 * Client IDs (not secret) default to the PlayTennis.by "playtennis-502214"
 * project clients; override via env if they change:
 *   GOOGLE_WEB_CLIENT_ID  — Web application client (Supabase provider Client ID)
 *   GOOGLE_IOS_CLIENT_ID  — iOS client (added to Authorized Client IDs so
 *                           signInWithIdToken accepts iOS-issued tokens)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "uvjvvkjodomesycdlydr";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const WEB_CLIENT_ID =
  process.env.GOOGLE_WEB_CLIENT_ID ??
  "1005010581419-d0vrmm3mc85uv563mvj5d065ahg5nero.apps.googleusercontent.com";
const IOS_CLIENT_ID =
  process.env.GOOGLE_IOS_CLIENT_ID ??
  "1005010581419-oooj9kskal3jr6t173f5ukp7get5nm8l.apps.googleusercontent.com";
const SITE_URL = process.env.SITE_URL ?? "https://www.playtennis.by";

const secretPath = path.join(ROOT, ".secrets/google-web-client-secret.txt");

if (!ACCESS_TOKEN) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens",
  );
  process.exit(1);
}

if (!fs.existsSync(secretPath)) {
  console.error(
    `Missing ${secretPath}. Save the Web client secret (GOCSPX-…) there — do not commit it.`,
  );
  process.exit(1);
}

const googleSecret = fs.readFileSync(secretPath, "utf8").trim();

// Supabase accepts a comma-separated list. The iOS client id must be present so
// native signInWithIdToken tokens (audience = iOS client) are accepted.
const body = {
  external_google_enabled: true,
  external_google_client_id: WEB_CLIENT_ID,
  external_google_secret: googleSecret,
  external_google_additional_client_ids: IOS_CLIENT_ID,
  site_url: SITE_URL,
  uri_allow_list: `${SITE_URL}/**,${SITE_URL}/api/auth/callback`,
};

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Supabase API error ${res.status}:`, text.slice(0, 500));
  process.exit(1);
}

console.log("Google provider configured on Supabase project", PROJECT_REF);
console.log("Web client ID:", WEB_CLIENT_ID);
console.log("Additional client IDs (iOS):", IOS_CLIENT_ID);
console.log("Site URL:", SITE_URL);
