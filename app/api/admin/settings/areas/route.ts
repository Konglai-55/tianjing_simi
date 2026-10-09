import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { updateAreas, validateAreaList } from "@/lib/settings";

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    areas?: unknown;
  } | null;
  const result = validateAreaList(body?.areas);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const areas = await updateAreas(result.areas);
  return NextResponse.json({ areas });
}


