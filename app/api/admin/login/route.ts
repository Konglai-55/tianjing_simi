import { NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminToken, verifyPassword } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !(await verifyPassword(body.password))) {
    return NextResponse.json({ error: "密码不正确" }, { status: 401 });
  }

  const token = await getAdminToken();
  if (!token) {
    return NextResponse.json({ error: "服务器尚未配置后台密码" }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const requestProtocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: requestProtocol === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}


