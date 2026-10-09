import { NextResponse } from "next/server";
import { incrementPostMetric } from "@/lib/posts";

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const views = await incrementPostMetric(slug, "views");
  if (views === null) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
  return NextResponse.json({ views });
}
