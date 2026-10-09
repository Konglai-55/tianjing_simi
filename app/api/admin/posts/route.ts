import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { CIRCLE_TYPES } from "@/lib/constants";
import { createPost, getAdminPosts } from "@/lib/posts";
import type { NewPostInput } from "@/types/post";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json({ posts: await getAdminPosts() });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

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
    return NextResponse.json({ error: "请填写标题和分类，并至少上传一张图片" }, { status: 400 });
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

  if (body.title.length > 100 || body.intro.length > 300 || body.content.length > 10000 || body.images.length > 20) {
    return NextResponse.json({ error: "内容或图片数量超过限制" }, { status: 400 });
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

  try {
    const post = await createPost({
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
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "发布失败" },
      { status: 409 },
    );
  }
}
