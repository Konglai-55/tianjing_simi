import { NextResponse } from "next/server";
import { incrementPostMetric } from "@/lib/posts";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const likes = await incrementPostMetric(slug, "likes");
  if (likes === null) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  return NextResponse.json({ likes });
}
