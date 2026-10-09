import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { setPostPublished } from "@/lib/posts";

type Context = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    isPublished?: unknown;
  } | null;
  if (!body || typeof body.isPublished !== "boolean") {
    return NextResponse.json({ error: "上下架状态无效" }, { status: 400 });
  }

  const { slug } = await params;
  const post = await setPostPublished(slug, body.isPublished);
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  return NextResponse.json({ post });
}
