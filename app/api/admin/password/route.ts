import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  getAdminToken,
  isAdmin,
  setAdminPassword,
  validateNewAdminPassword,
  verifyPassword,
} from "@/lib/admin-auth";

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;
  const currentPassword = body?.currentPassword || "";
  const newPassword = body?.newPassword || "";
  const passwordError = validateNewAdminPassword(newPassword);

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "请填写当前密码和新密码" }, { status: 400 });
  }
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (!(await verifyPassword(currentPassword))) {
    return NextResponse.json({ error: "当前密码不正确" }, { status: 401 });
  }

  await setAdminPassword(newPassword);
  const token = await getAdminToken();
  if (!token) {
    return NextResponse.json({ error: "新密码保存失败" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const requestProtocol =
    forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: requestProtocol === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}


