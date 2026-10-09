import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  getSiteAccessToken,
  verifyFrontendPassword,
} from "@/lib/site-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !(await verifyFrontendPassword(body.password))) {
    return NextResponse.json({ error: "密码不正确" }, { status: 401 });
  }

  const token = await getSiteAccessToken();
  const response = NextResponse.json({ ok: true });
  if (!token) return response;

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    .trim();
  const requestProtocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
  response.cookies.set(SITE_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: requestProtocol === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}


