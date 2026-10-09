import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TutorialContent } from "@/types/post";

const tutorialFile = process.env.TUTORIAL_FILE
  ? path.resolve(process.env.TUTORIAL_FILE)
  : path.join(process.cwd(), "data", "tutorial.json");

const defaultTutorial: TutorialContent = {
  title: "使用教程",
  content: "点击卡片查看详细资料，也可以使用区域、圈型和特点快速筛选。\n如需进一步了解使用方式，请联系网站管理员。",
  images: [],
  isPublished: true,
  updatedAt: new Date(0).toISOString(),
};

let writeQueue: Promise<unknown> = Promise.resolve();

export async function getTutorial(): Promise<TutorialContent> {
  try {
    const raw = await readFile(tutorialFile, "utf8");
    return { ...defaultTutorial, ...(JSON.parse(raw) as Partial<TutorialContent>) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultTutorial;
    throw error;
  }
}

export async function updateTutorial(
  input: Pick<TutorialContent, "title" | "content" | "images" | "isPublished">,
) {
  const task = writeQueue.then(async () => {
    const tutorial: TutorialContent = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    await mkdir(path.dirname(tutorialFile), { recursive: true });
    await writeFile(tutorialFile, `${JSON.stringify(tutorial, null, 2)}\n`, "utf8");
    return tutorial;
  });
  writeQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
