import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getSiteSettings, toAdminSafeSettings, updateFrontendPasswordSettings } from "@/lib/settings";
import { hashFrontendPassword, validateFrontendPassword } from "@/lib/site-auth";

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    enabled?: unknown;
    password?: unknown;
  } | null;
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "前台密码设置格式不正确" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const current = await getSiteSettings();
  if (body.enabled && !current.frontendPasswordHash && !password) {
    return NextResponse.json({ error: "开启前台密码前，请先设置密码" }, { status: 400 });
  }

  let frontendPasswordHash: string | undefined;
  if (password) {
    const passwordError = validateFrontendPassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
    frontendPasswordHash = hashFrontendPassword(password);
  }

  const settings = await updateFrontendPasswordSettings({
    enabled: body.enabled,
    frontendPasswordHash,
  });
  return NextResponse.json({ settings: toAdminSafeSettings({
    ...current,
    ...settings,
    frontendPasswordHash: frontendPasswordHash || current.frontendPasswordHash,
  }) });
}


