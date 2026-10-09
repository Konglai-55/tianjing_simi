import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deleteMediaUrls } from "@/lib/s3";
import { getTutorial, updateTutorial } from "@/lib/tutorial";
import type { PostImage, TutorialContent } from "@/types/post";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  return NextResponse.json({ tutorial: await getTutorial() });
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as TutorialContent | null;
  if (
    !body ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 80 ||
    typeof body.content !== "string" ||
    body.content.length > 10000 ||
    typeof body.isPublished !== "boolean" ||
    !Array.isArray(body.images) ||
    body.images.length > 12
  ) {
    return NextResponse.json({ error: "教程内容不完整或超过限制" }, { status: 400 });
  }

  const imagesAreValid = body.images.every(
    (image): image is PostImage =>
      typeof image?.url === "string" &&
      typeof image?.thumbnailUrl === "string" &&
      image.url.startsWith("https://") &&
      image.thumbnailUrl.startsWith("https://"),
  );
  if (!imagesAreValid) {
    return NextResponse.json({ error: "教程图片地址无效" }, { status: 400 });
  }

  const previous = await getTutorial();
  const tutorial = await updateTutorial({
    title: body.title.trim(),
    content: body.content.trim(),
    images: body.images,
    isPublished: body.isPublished,
  });

  const retainedUrls = new Set(
    tutorial.images.flatMap((image) => [image.url, image.thumbnailUrl]),
  );
  const removedUrls = previous.images
    .flatMap((image) => [image.url, image.thumbnailUrl])
    .filter((url) => !retainedUrls.has(url));
  let cleanupWarning: string | undefined;
  try {
    await deleteMediaUrls(removedUrls);
  } catch {
    cleanupWarning = "教程已保存，但旧图片清理失败";
  }

  return NextResponse.json({ tutorial, cleanupWarning });
}
