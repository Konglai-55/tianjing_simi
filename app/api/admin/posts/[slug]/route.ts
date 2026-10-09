import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { CIRCLE_TYPES } from "@/lib/constants";
import { deletePost, getAdminPosts, updatePost } from "@/lib/posts";
import { deleteMediaUrls, deletePostMedia } from "@/lib/s3";
import type { NewPostInput } from "@/types/post";

type Context = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as NewPostInput | null;
  if (
    !body ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    typeof body.area !== "string" ||
    !body.area.trim() ||
    !CIRCLE_TYPES.includes(body.circle) ||
    !Array.isArray(body.features) ||
    typeof body.intro !== "string" ||
    typeof body.content !== "string" ||
    !Array.isArray(body.images) ||
    body.images.length === 0
  ) {
    return NextResponse.json({ error: "帖子内容不完整" }, { status: 400 });
  }

  if (
    body.title.length > 100 ||
    body.intro.length > 300 ||
    body.content.length > 10000 ||
    body.images.length > 20
  ) {
    return NextResponse.json({ error: "内容或图片数量超过限制" }, { status: 400 });
  }

  const featuresAreValid = body.features.every(
    (feature) => typeof feature === "string" && feature.trim().length <= 20,
  );
  if (!featuresAreValid || body.features.length > 10) {
    return NextResponse.json({ error: "特点最多填写 10 个，每个不超过 20 字" }, { status: 400 });
  }

  if (
    !Number.isInteger(body.initialViews) ||
    !Number.isInteger(body.initialLikes) ||
    body.initialViews < 0 ||
    body.initialLikes < 0 ||
    body.initialViews > 999999999 ||
    body.initialLikes > 999999999
  ) {
    return NextResponse.json({ error: "浏览量和点赞量必须是有效的非负整数" }, { status: 400 });
  }

  const urlsAreValid = body.images.every(
    (image) =>
      typeof image.url === "string" &&
      typeof image.thumbnailUrl === "string" &&
      image.url.startsWith("https://") &&
      image.thumbnailUrl.startsWith("https://"),
  );
  if (!urlsAreValid) {
    return NextResponse.json({ error: "图片地址无效" }, { status: 400 });
  }

  const previous = (await getAdminPosts()).find((post) => post.slug === slug);
  const post = await updatePost(slug, {
    title: body.title.trim(),
    area: body.area.trim(),
    circle: body.circle,
    features: [...new Set(body.features.map((feature) => feature.trim()).filter(Boolean))],
    initialViews: body.initialViews,
    initialLikes: body.initialLikes,
    intro: body.intro.trim(),
    content: body.content.trim(),
    images: body.images,
    videoUrl: body.videoUrl?.startsWith("https://") ? body.videoUrl : undefined,
  });
  if (!post) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }
  const retainedUrls = new Set(post.images.flatMap((image) => [image.url, image.thumbnailUrl]));
  const removedUrls = (previous?.images || [])
    .flatMap((image) => [image.url, image.thumbnailUrl])
    .filter((url) => !retainedUrls.has(url));
  let cleanupWarning: string | undefined;
  try {
    await deleteMediaUrls(removedUrls);
  } catch {
    cleanupWarning = "修改已保存，但旧图片清理失败";
  }
  return NextResponse.json({ post, cleanupWarning });
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { slug } = await params;
  const deleted = await deletePost(slug);
  if (!deleted) {
    return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  }

  try {
    const removedMedia = await deletePostMedia(deleted);
    return NextResponse.json({ ok: true, removedMedia });
  } catch {
    return NextResponse.json({
      ok: true,
      removedMedia: 0,
      cleanupWarning: "帖子已删除，但对象存储文件清理失败",
    });
  }
}
