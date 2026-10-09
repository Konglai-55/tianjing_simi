import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

process.loadEnvFile(".env.local");

const outputDir = process.env.VISUAL_DIR || path.join(process.cwd(), "screenshots");
const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:3000";
await mkdir(outputDir, { recursive: true });

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
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    !message.text().includes("Failed to load resource") &&
    !message.text().includes("/_next/webpack-hmr")
  ) {
    errors.push(message.text());
  }
});

async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1800);
}

async function inspect(name) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  await page.screenshot({ path: path.join(outputDir, `${name}.png`) });
  return metrics;
}

const results = {};

await page.goto(`${baseUrl}/`);
await settle();
results.home = await inspect("home-mobile");
const tutorialButton = page.locator(".tutorial-entry > button");
results.tutorialEntryVisible = await tutorialButton.isVisible().catch(() => false);
if (results.tutorialEntryVisible) {
  await tutorialButton.click();
  await page.waitForTimeout(250);
  results.tutorialModalVisible = await page.getByRole("dialog").isVisible();
  results.tutorial = await inspect("tutorial-mobile");
  await page.getByRole("button", { name: "关闭教程", exact: true }).last().click();
}

const pagination = page.getByRole("navigation", { name: "帖子分页" });
results.paginationVisible = await pagination.isVisible().catch(() => false);
if (results.paginationVisible) {
  await pagination.getByRole("button", { name: "2", exact: true }).click();
  await page.waitForFunction(() => new URLSearchParams(window.location.search).get("page") === "2");
  const pageTwoCardLink = page.locator(".post-card a").first();
  await pageTwoCardLink.scrollIntoViewIfNeeded();
  const expectedReturnScroll = await page.evaluate(() => window.scrollY);
  await pageTwoCardLink.click();
  await settle();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => new URLSearchParams(window.location.search).get("page") === "2");
  await settle();
  const actualReturnScroll = await page.evaluate(() => window.scrollY);
  results.returnedPageNumber = await page.locator(".pagination .is-active").textContent();
  results.returnedPageUrl = page.url();
  results.returnedScrollRestored = Math.abs(actualReturnScroll - expectedReturnScroll) <= 24;
  await page.goto(`${baseUrl}/`);
  await settle();
}

const detailHref = await page.locator(".post-card a").first().getAttribute("href");
const firstNumber = (await page.locator(".number-badge").first().textContent())?.replace(/\D/g, "") || "";
await page.getByLabel("搜索名字或编号").fill(firstNumber);
await page.getByRole("button", { name: "搜索", exact: true }).click();
results.searchResultCards = await page.locator(".post-card").count();
results.areaFilterVisible = await page.getByLabel("按区域筛选").isVisible();

if (!detailHref) throw new Error("视觉检查未找到帖子详情链接");
await page.goto(`${baseUrl}${detailHref}`);
await settle();
results.detail = await inspect("detail-mobile");
results.detailShowsDate = /\d{4}[\/.年-]\d{1,2}/.test(await page.locator(".detail-kicker").innerText());
results.detailImages = await page.locator(".detail-gallery img").evaluateAll((images) =>
  images.map((image) => {
    const figure = image.closest("figure");
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: image.clientWidth,
      renderedHeight: image.clientHeight,
      figureHeight: figure?.clientHeight || 0,
      clipped: Boolean(figure && figure.clientHeight + 1 < image.clientHeight),
    };
  }),
);

await page.goto(`${baseUrl}/admin`);
await settle();
results.adminLogin = await inspect("admin-login-mobile");
const loginResponse = await context.request.post(`${baseUrl}/api/admin/login`, {
  data: { password: process.env.ADMIN_PASSWORD || "" },
});
if (!loginResponse.ok()) throw new Error("视觉检查无法登录内容后台");
await page.goto(`${baseUrl}/admin`);
await page.locator(".publisher-form").waitFor({ timeout: 10_000 });
await settle();
results.managedPosts = await page.locator(".managed-post-list article").count();
results.admin = await inspect("admin-mobile");
await page.getByRole("button", { name: "相册管理", exact: true }).click();
await page.waitForTimeout(400);
results.libraryVisible = await page.locator(".tab-library .post-manager").isVisible();
if (results.libraryVisible) {
  results.library = await inspect("admin-library-mobile");
  await page.locator(".managed-post-list article").first().getByRole("button", { name: "编辑", exact: true }).click();
  await page.waitForTimeout(300);
  results.editableCardImages = await page.locator(".publisher-form .upload-previews > div").count();
  results.edit = await inspect("admin-edit-mobile");
}
await page.getByRole("button", { name: "教程编辑", exact: true }).click();
await page.waitForTimeout(400);
results.tutorialEditorVisible = await page.locator(".tutorial-editor").isVisible();
results.tutorialEditor = await inspect("admin-tutorial-mobile");
await page.getByRole("button", { name: "设置", exact: true }).click();
await page.waitForTimeout(400);
results.settingsVisible = await page.locator(".settings-panel").isVisible();
results.areaManagerVisible = await page.locator(".area-add-form").isVisible();
results.passwordManagerVisible = await page.locator(".password-form").last().isVisible();
results.settings = await inspect("admin-settings-mobile");
await page.getByRole("button", { name: "发布", exact: true }).click();
await page.waitForTimeout(300);
await page.locator('.publisher-form input[type="file"][accept="image/*"]').setInputFiles(path.join(outputDir, "home-mobile.png"));
await page.locator(".preview-crop").click();
await page.waitForTimeout(400);
results.cropperVisible = await page.locator(".cropper-dialog").isVisible();
if (results.cropperVisible) results.cropper = await inspect("cropper-mobile");

await browser.close();
console.log(JSON.stringify({ results, errors }, null, 2));
