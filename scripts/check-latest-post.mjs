import { readFile } from "node:fs/promises";

const posts = JSON.parse(await readFile("data/posts.json", "utf8")).sort(
  (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
);
const latest = posts[0];

console.log(`POST_FOUND=${Boolean(latest)} IMAGES=${latest?.images?.length || 0}`);

if (!latest?.images?.[0]?.thumbnailUrl) process.exit(1);

try {
  const response = await fetch(latest.images[0].thumbnailUrl);
  console.log(
    `COVER_HTTP=${response.status} CONTENT_TYPE=${response.headers.get("content-type") || ""}`,
  );
  await response.body?.cancel();
  process.exitCode = response.ok ? 0 : 1;
} catch (error) {
  console.error(
    `COVER_FETCH_FAILED=${error.message} CAUSE=${error.cause?.code || ""}`,
  );
  process.exitCode = 1;
}
