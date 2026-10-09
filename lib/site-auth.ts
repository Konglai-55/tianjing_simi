import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SiteSettings } from "@/lib/settings";
import { getSiteSettings } from "@/lib/settings";

export const SITE_ACCESS_COOKIE = "jinmen_site_access";
const PASSWORD_HASH_SCHEME = "scrypt";

export function hashFrontendPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${PASSWORD_HASH_SCHEME}:${salt}:${key}`;
}

function verifyPasswordHash(password: string, storedHash: string) {
  const [scheme, salt, key] = storedHash.split(":");
  if (scheme !== PASSWORD_HASH_SCHEME || !salt || !key) return false;

  const expected = Buffer.from(key, "hex");
  if (expected.length === 0) return false;

  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function expectedSiteToken(settings: SiteSettings) {
  if (!settings.frontendPasswordEnabled || !settings.frontendPasswordHash) {
    return null;
  }
  const secret = process.env.ADMIN_SESSION_SECRET || settings.frontendPasswordHash;
  return createHash("sha256")
    .update(`site:${settings.frontendPasswordHash}:${secret}`)
    .digest("hex");
}

export function validateFrontendPassword(password: string) {
  if (password.length < 4) return "前台密码至少需要 4 位";
  if (password.length > 100) return "前台密码不能超过 100 位";
  return null;
}

export async function verifyFrontendPassword(password: string) {
  const settings = await getSiteSettings();
  if (!settings.frontendPasswordEnabled || !settings.frontendPasswordHash) {
    return true;
  }
  return verifyPasswordHash(password, settings.frontendPasswordHash);
}

export async function getSiteAccessToken() {
  return expectedSiteToken(await getSiteSettings());
}

export async function verifySiteAccessToken(value?: string, settings?: SiteSettings) {
  const expected = expectedSiteToken(settings || await getSiteSettings());
  if (!expected) return true;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isSiteUnlocked(settings?: SiteSettings) {
  const nextSettings = settings || await getSiteSettings();
  if (!nextSettings.frontendPasswordEnabled || !nextSettings.frontendPasswordHash) {
    return true;
  }
  const store = await cookies();
  return verifySiteAccessToken(store.get(SITE_ACCESS_COOKIE)?.value, nextSettings);
}


