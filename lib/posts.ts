import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ModelPost, NewPostInput } from "@/types/post";

const postsFile = process.env.POSTS_FILE
  ? path.resolve(process.env.POSTS_FILE)
  : path.join(process.cwd(), "data", "posts.json");
let writeQueue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<ModelPost[]> {
  try {
    const raw = await readFile(postsFile, "utf8");
    const data = JSON.parse(raw) as ModelPost[];
    return data.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveAll(posts: ModelPost[]) {
  await mkdir(path.dirname(postsFile), { recursive: true });
  await writeFile(postsFile, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

function generateModelNumber(posts: ModelPost[]) {
  const usedNumbers = new Set(
    posts
      .map((post) => Number(post.modelNumber))
      .filter((value) => Number.isInteger(value) && value >= 1000 && value <= 9999),
  );
  if (usedNumbers.size >= 9000) {
    throw new Error("1000–9999 的帖子编号已经全部使用");
  }

  let nextNumber: number;
  do {
    nextNumber = randomInt(1000, 10000);
  } while (usedNumbers.has(nextNumber));
  return String(nextNumber);
}

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getPosts() {
  const posts = await readAll();
  return posts.filter((post) => post.isPublished !== false);
}

export async function getAdminPosts() {
  return readAll();
}

export async function getPost(slug: string) {
  const posts = await readAll();
  return posts.find(
    (post) => post.slug === slug && post.isPublished !== false,
  ) ?? null;
}

export async function getPostContext(slug: string) {
  const posts = (await readAll()).filter((post) => post.isPublished !== false);
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return null;

  return {
    post: posts[index],
    previous: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
    recent: posts.filter((item) => item.slug !== slug).slice(0, 4),
  };
}

export async function createPost(input: NewPostInput) {
  return withWriteLock(async () => {
    const posts = await readAll();
    const modelNumber = generateModelNumber(posts);
    const { initialViews, initialLikes, ...postInput } = input;
    const post: ModelPost = {
      ...postInput,
      modelNumber,
      id: randomUUID(),
      slug: `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
      views: initialViews,
      likes: initialLikes,
      isPublished: true,
      publishedAt: new Date().toISOString(),
      videoUrl: input.videoUrl || undefined,
    };
    posts.unshift(post);
    await saveAll(posts);
    return post;
  });
}

export async function updatePost(slug: string, input: NewPostInput) {
  return withWriteLock(async () => {
    const posts = await readAll();
    const index = posts.findIndex((item) => item.slug === slug);
    if (index === -1) return null;
    const { initialViews, initialLikes, ...postInput } = input;

    posts[index] = {
      ...posts[index],
      ...postInput,
      modelNumber: posts[index].modelNumber,
      views: initialViews,
      likes: initialLikes,
      videoUrl: input.videoUrl || undefined,
    };
    await saveAll(posts);
    return posts[index];
  });
}

export async function deletePost(slug: string) {
  return withWriteLock(async () => {
    const posts = await readAll();
    const index = posts.findIndex((item) => item.slug === slug);
    if (index === -1) return null;

    const [deleted] = posts.splice(index, 1);
    await saveAll(posts);
    return deleted;
  });
}

export async function setPostPublished(slug: string, isPublished: boolean) {
  return withWriteLock(async () => {
    const posts = await readAll();
    const post = posts.find((item) => item.slug === slug);
    if (!post) return null;
    post.isPublished = isPublished;
    await saveAll(posts);
    return post;
  });
}

export async function incrementPostMetric(
  slug: string,
  metric: "views" | "likes",
) {
  return withWriteLock(async () => {
    const posts = await readAll();
    const post = posts.find((item) => item.slug === slug);
    if (!post || post.isPublished === false) return null;
    post[metric] += 1;
    await saveAll(posts);
    return post[metric];
  });
}
