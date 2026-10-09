import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createUploadUrl } from "@/lib/s3";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    fileName?: string;
    contentType?: string;
    kind?: "image" | "thumb" | "video";
  } | null;

  if (!body?.fileName || !body.contentType || !body.kind) {
    return NextResponse.json({ error: "文件信息不完整" }, { status: 400 });
  }

  try {
    return NextResponse.json(await createUploadUrl({
      fileName: body.fileName,
      contentType: body.contentType,
      kind: body.kind,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法创建上传地址";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
