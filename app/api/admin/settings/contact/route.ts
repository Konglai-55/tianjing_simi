import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { updateContactSettings, validateContactSettings } from "@/lib/settings";

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = validateContactSettings(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const contact = await updateContactSettings(result.contact);
  return NextResponse.json({ contact });
}


