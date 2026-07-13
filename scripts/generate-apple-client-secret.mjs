#!/usr/bin/env node
/**
 * Generates Sign in with Apple client_secret JWT (ES256) and writes it to
 * .secrets/apple-client-secret.jwt. The .p8 key must live in .secrets/ (gitignored).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TEAM_ID = process.env.APPLE_TEAM_ID ?? "VH4L4R7PKW";
const KEY_ID = process.env.APPLE_KEY_ID ?? "VRRXAB992H";
const SERVICES_ID = process.env.APPLE_SERVICES_ID ?? "by.playtennis.app.web";
const keyPath =
  process.env.APPLE_PRIVATE_KEY_PATH ??
  path.join(ROOT, ".secrets", `AuthKey_${KEY_ID}.p8`);

if (!fs.existsSync(keyPath)) {
  console.error(`Missing private key at ${keyPath}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, "utf8");
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 180 - 60;

const header = { alg: "ES256", kid: KEY_ID };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: SERVICES_ID,
};

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const signingInput = `${b64url(header)}.${b64url(payload)}`;
const sign = crypto.createSign("SHA256");
sign.update(signingInput);
sign.end();
const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
const jwt = `${signingInput}.${signature.toString("base64url")}`;

const outPath = path.join(ROOT, ".secrets/apple-client-secret.jwt");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, jwt, { mode: 0o600 });

console.log("Wrote", outPath);
console.log("Team ID:", TEAM_ID);
console.log("Key ID:", KEY_ID);
console.log("Services ID:", SERVICES_ID);
console.log("Expires (unix):", exp);
