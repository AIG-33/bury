#!/usr/bin/env node
/**
 * Applies Apple OAuth provider settings to the hosted Supabase project via the
 * Management API. Requires SUPABASE_ACCESS_TOKEN (sbp_…) from the dashboard.
 *
 * Reads the generated client secret from .secrets/apple-client-secret.jwt
 * (created by scripts/generate-apple-client-secret.mjs). Never commit secrets.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "uvjvvkjodomesycdlydr";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SERVICES_ID = process.env.APPLE_SERVICES_ID ?? "by.playtennis.app.web";
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? "by.playtennis.app";
const SITE_URL = process.env.SITE_URL ?? "https://www.playtennis.by";

const secretPath = path.join(ROOT, ".secrets/apple-client-secret.jwt");

if (!ACCESS_TOKEN) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens",
  );
  process.exit(1);
}

if (!fs.existsSync(secretPath)) {
  console.error(`Missing ${secretPath}. Run: node scripts/generate-apple-client-secret.mjs`);
  process.exit(1);
}

const appleSecret = fs.readFileSync(secretPath, "utf8").trim();

const body = {
  external_apple_enabled: true,
  external_apple_client_id: SERVICES_ID,
  external_apple_secret: appleSecret,
  external_apple_additional_client_ids: BUNDLE_ID,
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

console.log("Apple provider configured on Supabase project", PROJECT_REF);
console.log("Services ID:", SERVICES_ID);
console.log("Additional client IDs (bundle):", BUNDLE_ID);
console.log("Site URL:", SITE_URL);
