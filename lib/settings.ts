import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_AREAS, SITE_NAME } from "@/lib/constants";

export type ContactSettings = {
  footerTitle: string;
  footerSubtitle: string;
  contactTitle: string;
  contactBody: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
};

export type SiteSettings = ContactSettings & {
  areas: string[];
  adminPasswordHash?: string;
  adminPasswordUpdatedAt?: string;
  frontendPasswordEnabled: boolean;
  frontendPasswordHash?: string;
  frontendPasswordUpdatedAt?: string;
};

export type AdminSafeSettings = ContactSettings & {
  areas: string[];
  frontendPasswordEnabled: boolean;
  frontendPasswordConfigured: boolean;
};

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  footerTitle: SITE_NAME,
  footerSubtitle: "让每一次创作，更快找到合适的人",
  contactTitle: "联系方式",
  contactBody: "请在后台设置联系方式、合作说明或客服时间。",
  primaryLabel: "微信",
  primaryValue: "请在后台填写",
  secondaryLabel: "备注",
  secondaryValue: "可自定义展示内容",
};

const CONTACT_LIMITS: Record<keyof ContactSettings, number> = {
  footerTitle: 40,
  footerSubtitle: 100,
  contactTitle: 40,
  contactBody: 1000,
  primaryLabel: 20,
  primaryValue: 160,
  secondaryLabel: 20,
  secondaryValue: 160,
};
const MAX_AREAS = 300;

const settingsFile = process.env.SETTINGS_FILE
  ? path.resolve(process.env.SETTINGS_FILE)
  : path.join(process.cwd(), "data", "settings.json");
let writeQueue: Promise<unknown> = Promise.resolve();

function normalizeAreaName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStoredAreas(value: unknown) {
  if (!Array.isArray(value)) return [...DEFAULT_AREAS];

  const seen = new Set<string>();
  const areas: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const area = normalizeAreaName(item);
    if (!area || area === "全部" || area.length > 20 || seen.has(area)) {
      continue;
    }
    seen.add(area);
    areas.push(area);
  }
  return areas.slice(0, MAX_AREAS);
}

function normalizeContactField(value: unknown, key: keyof ContactSettings) {
  if (typeof value !== "string") return DEFAULT_CONTACT_SETTINGS[key];
  return value.trim().slice(0, CONTACT_LIMITS[key]);
}

function sanitizeContactSettings(value: Partial<ContactSettings> | null | undefined): ContactSettings {
  return {
    footerTitle: normalizeContactField(value?.footerTitle, "footerTitle"),
    footerSubtitle: normalizeContactField(value?.footerSubtitle, "footerSubtitle"),
    contactTitle: normalizeContactField(value?.contactTitle, "contactTitle"),
    contactBody: normalizeContactField(value?.contactBody, "contactBody"),
    primaryLabel: normalizeContactField(value?.primaryLabel, "primaryLabel"),
    primaryValue: normalizeContactField(value?.primaryValue, "primaryValue"),
    secondaryLabel: normalizeContactField(value?.secondaryLabel, "secondaryLabel"),
    secondaryValue: normalizeContactField(value?.secondaryValue, "secondaryValue"),
  };
}

function sanitizeSettings(value: unknown): SiteSettings {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_CONTACT_SETTINGS,
      areas: [...DEFAULT_AREAS],
      frontendPasswordEnabled: false,
    };
  }

  const data = value as Partial<SiteSettings>;
  return {
    ...sanitizeContactSettings(data),
    areas: Object.hasOwn(data, "areas")
      ? normalizeStoredAreas(data.areas)
      : [...DEFAULT_AREAS],
    adminPasswordHash:
      typeof data.adminPasswordHash === "string" && data.adminPasswordHash
        ? data.adminPasswordHash
        : undefined,
    adminPasswordUpdatedAt:
      typeof data.adminPasswordUpdatedAt === "string" &&
      data.adminPasswordUpdatedAt
        ? data.adminPasswordUpdatedAt
        : undefined,
    frontendPasswordEnabled: data.frontendPasswordEnabled === true,
    frontendPasswordHash:
      typeof data.frontendPasswordHash === "string" && data.frontendPasswordHash
        ? data.frontendPasswordHash
        : undefined,
    frontendPasswordUpdatedAt:
      typeof data.frontendPasswordUpdatedAt === "string" &&
      data.frontendPasswordUpdatedAt
        ? data.frontendPasswordUpdatedAt
        : undefined,
  };
}

async function readSettingsFile() {
  try {
    const raw = await readFile(settingsFile, "utf8");
    return sanitizeSettings(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ...DEFAULT_CONTACT_SETTINGS,
        areas: [...DEFAULT_AREAS],
        frontendPasswordEnabled: false,
      };
    }
    throw error;
  }
}

async function saveSettings(settings: SiteSettings) {
  await mkdir(path.dirname(settingsFile), { recursive: true });
  await writeFile(
    settingsFile,
    `${JSON.stringify(sanitizeSettings(settings), null, 2)}\n`,
    "utf8",
  );
}

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function validateAreaList(value: unknown):
  | { areas: string[]; error?: never }
  | { areas?: never; error: string } {
  if (!Array.isArray(value)) {
    return { error: "区域列表格式不正确" };
  }
  if (value.length > MAX_AREAS) {
    return { error: `区域最多保留 ${MAX_AREAS} 个` };
  }

  const seen = new Set<string>();
  const areas: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return { error: "区域名称必须是文字" };
    }
    const area = normalizeAreaName(item);
    if (!area) {
      return { error: "区域名称不能为空" };
    }
    if (area === "全部") {
      return { error: "“全部”是系统筛选项，不能作为区域名称" };
    }
    if (area.length > 20) {
      return { error: "区域名称不能超过 20 个字" };
    }
    if (!seen.has(area)) {
      seen.add(area);
      areas.push(area);
    }
  }

  return { areas };
}

export function validateContactSettings(value: unknown):
  | { contact: ContactSettings; error?: never }
  | { contact?: never; error: string } {
  if (!value || typeof value !== "object") {
    return { error: "联系方式设置格式不正确" };
  }

  const data = value as Partial<Record<keyof ContactSettings, unknown>>;
  const contact: Partial<ContactSettings> = {};
  for (const key of Object.keys(CONTACT_LIMITS) as Array<keyof ContactSettings>) {
    const field = data[key];
    if (typeof field !== "string") {
      return { error: "联系方式设置必须是文字" };
    }
    if (field.length > CONTACT_LIMITS[key]) {
      return { error: "联系方式内容过长" };
    }
    contact[key] = field.trim();
  }

  return { contact: sanitizeContactSettings(contact) };
}

export function toAdminSafeSettings(settings: SiteSettings): AdminSafeSettings {
  const contact = sanitizeContactSettings(settings);
  return {
    ...contact,
    areas: settings.areas,
    frontendPasswordEnabled: settings.frontendPasswordEnabled,
    frontendPasswordConfigured: Boolean(settings.frontendPasswordHash),
  };
}

export function toContactSettings(settings: SiteSettings): ContactSettings {
  return sanitizeContactSettings(settings);
}

export async function getSiteSettings() {
  return readSettingsFile();
}

export async function getAreas() {
  return (await getSiteSettings()).areas;
}

export async function updateAreas(areas: string[]) {
  return withWriteLock(async () => {
    const current = await readSettingsFile();
    const next = { ...current, areas };
    await saveSettings(next);
    return next.areas;
  });
}

export async function updateContactSettings(contact: ContactSettings) {
  return withWriteLock(async () => {
    const current = await readSettingsFile();
    const next = { ...current, ...sanitizeContactSettings(contact) };
    await saveSettings(next);
    return toContactSettings(next);
  });
}

export async function updateFrontendPasswordSettings(input: {
  enabled: boolean;
  frontendPasswordHash?: string;
}) {
  return withWriteLock(async () => {
    const current = await readSettingsFile();
    const next: SiteSettings = {
      ...current,
      frontendPasswordEnabled: input.enabled,
      frontendPasswordHash: input.frontendPasswordHash || current.frontendPasswordHash,
      frontendPasswordUpdatedAt: input.frontendPasswordHash
        ? new Date().toISOString()
        : current.frontendPasswordUpdatedAt,
    };
    await saveSettings(next);
    return toAdminSafeSettings(next);
  });
}

export async function updateAdminPasswordHash(adminPasswordHash: string) {
  return withWriteLock(async () => {
    const current = await readSettingsFile();
    await saveSettings({
      ...current,
      adminPasswordHash,
      adminPasswordUpdatedAt: new Date().toISOString(),
    });
  });
}

