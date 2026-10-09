import { chromium } from "playwright-core";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
});
const page = await context.newPage();
const errors = [];
const failedResources = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
    errors.push(message.text());
  }
});
page.on("response", (response) => {
  if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator(".post-card").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(5000);
  const pagination = page.getByRole("navigation", { name: "帖子分页" });
  if (!(await pagination.isVisible())) throw new Error("测试数据不足 9 条，无法验证第二页返回行为");

  await pagination.getByRole("button", { name: "2", exact: true }).click();
  await page.waitForFunction(() => new URLSearchParams(window.location.search).get("page") === "2");
  const pageTwoCard = page.locator(".post-card").first();
  await pageTwoCard.scrollIntoViewIfNeeded();
  const expectedScroll = await page.evaluate(() => window.scrollY);
  await pageTwoCard.locator("a").first().click();
  await page.waitForURL(/\/posts\//);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => new URLSearchParams(window.location.search).get("page") === "2");
  await page.locator(".pagination .is-active").waitFor();
  await page.waitForTimeout(300);

  const actualScroll = await page.evaluate(() => window.scrollY);
  const activePage = (await page.locator(".pagination .is-active").textContent())?.trim();
  const result = {
    activePage,
    url: page.url(),
    expectedScroll,
    actualScroll,
    scrollDelta: Math.abs(actualScroll - expectedScroll),
    errors,
    failedResources,
  };
  console.log(JSON.stringify(result, null, 2));
  if (activePage !== "2") throw new Error(`返回后的页码错误：${activePage || "空"}`);
  if (result.scrollDelta > 24) throw new Error(`返回后的滚动位置偏差过大：${result.scrollDelta}px`);
  if (errors.length > 0) throw new Error(`页面出现运行错误：${errors.join("；")}`);
  if (failedResources.length > 0) throw new Error(`页面资源加载失败：${failedResources.join("；")}`);
} finally {
  await browser.close();
}
