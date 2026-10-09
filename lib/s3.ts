import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ModelPost } from "@/types/post";

const allowedTypes = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !publicBaseUrl || !accessKeyId || !secretAccessKey) {
    throw new Error("对象存储环境变量尚未配置完整");
  }

  return { endpoint, bucket, publicBaseUrl, accessKeyId, secretAccessKey };
}

function createClient(values: ReturnType<typeof config>) {
  return new S3Client({
    endpoint: values.endpoint,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: values.accessKeyId,
      secretAccessKey: values.secretAccessKey,
    },
  });
}

function extensionFor(contentType: string, fileName: string) {
  const known: Record<string, string> = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return known[contentType] || fileName.split(".").pop()?.toLowerCase() || "bin";
}

export async function createUploadUrl(input: {
  fileName: string;
  contentType: string;
  kind: "image" | "thumb" | "video";
}) {
  if (!allowedTypes.has(input.contentType)) {
    throw new Error("不支持这种文件类型");
  }

  const values = config();
  const client = createClient(values);

  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `posts/${folder}/${input.kind}-${randomUUID()}.${extensionFor(input.contentType, input.fileName)}`;
  const cacheControl = "public, max-age=31536000, immutable";
  const command = new PutObjectCommand({
    Bucket: values.bucket,
    Key: key,
    ContentType: input.contentType,
    CacheControl: cacheControl,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  return {
    uploadUrl,
    publicUrl: `${values.publicBaseUrl.replace(/\/$/, "")}/${key}`,
    cacheControl,
  };
}

export async function deletePostMedia(post: ModelPost) {
  const urls = new Set<string>();
  for (const image of post.images) {
    urls.add(image.url);
    urls.add(image.thumbnailUrl);
  }
  if (post.videoUrl) urls.add(post.videoUrl);

  return deleteMediaUrls([...urls]);
}

export async function deleteMediaUrls(mediaUrls: string[]) {
  if (mediaUrls.length === 0) return 0;
  const values = config();
  const base = new URL(values.publicBaseUrl);

  const keys = [...new Set(mediaUrls)].flatMap((value) => {
    try {
      const url = new URL(value);
      if (url.host !== base.host) return [];
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      return key.startsWith("posts/") ? [key] : [];
    } catch {
      return [];
    }
  });
  if (keys.length === 0) return 0;

  const client = createClient(values);
  await Promise.all(
    keys.map((key) =>
      client.send(
        new DeleteObjectCommand({ Bucket: values.bucket, Key: key }),
      ),
    ),
  );
  return keys.length;
}
