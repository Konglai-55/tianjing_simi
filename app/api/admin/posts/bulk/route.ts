import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deletePost } from "@/lib/posts";
import { deletePostMedia } from "@/lib/s3";

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { slugs?: unknown } | null;
  const slugs = Array.isArray(body?.slugs)
    ? [...new Set(body.slugs.filter((slug): slug is string => typeof slug === "string" && slug.length > 0))]
    : [];
  if (slugs.length === 0 || slugs.length > 500) {
    return NextResponse.json({ error: "请选择要删除的相册" }, { status: 400 });
  }
  let deleted = 0;
  let cleanupWarning = false;
  for (const slug of slugs) {
    const post = await deletePost(slug);
    if (!post) continue;
    deleted += 1;
    try { await deletePostMedia(post); } catch { cleanupWarning = true; }
  }
  return NextResponse.json({ ok: true, deleted, cleanupWarning: cleanupWarning ? "部分对象存储文件清理失败" : undefined });
}
