import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSiteSettings, updateAdminPasswordHash } from "@/lib/settings";

export const ADMIN_COOKIE = "jinmen_admin";
const PASSWORD_HASH_SCHEME = "scrypt";

async function getPasswordCredential() {
  const settings = await getSiteSettings();
  if (settings.adminPasswordHash) {
    return { type: "hash", value: settings.adminPasswordHash };
  }

  const password = process.env.ADMIN_PASSWORD;
  return password ? { type: "env", value: password } : null;
}

async function expectedToken() {
  const credential = await getPasswordCredential();
  if (!credential) return null;
  const secret = process.env.ADMIN_SESSION_SECRET || credential.value;
  return createHash("sha256")
    .update(`jinmen:${credential.type}:${credential.value}:${secret}`)
    .digest("hex");
}

function hashPassword(password: string) {
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

export async function verifyPassword(password: string) {
  const credential = await getPasswordCredential();
  if (!credential) return false;

  if (credential.type === "hash") {
    return verifyPasswordHash(password, credential.value);
  }

  const a = Buffer.from(password);
  const b = Buffer.from(credential.value);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminPassword(password: string) {
  await updateAdminPasswordHash(hashPassword(password));
}

export function validateNewAdminPassword(password: string) {
  if (password.length < 8) return "新密码至少需要 8 位";
  if (password.length > 100) return "新密码不能超过 100 位";
  return null;
}

export function getAdminToken() {
  return expectedToken();
}

export async function verifyAdminToken(value?: string) {
  const expected = await expectedToken();
  if (!expected || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin() {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}


