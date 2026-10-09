import { chromium } from "playwright-core";

process.loadEnvFile(".env.local");
const baseUrl = process.env.ADMIN_QA_BASE_URL || "http://127.0.0.1:3000";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(10_000);
const diagnostics = [];

page.on("console", (message) => diagnostics.push(`console:${message.type()}:${message.text()}`));
page.on("pageerror", (error) => diagnostics.push(`pageerror:${error.message}`));
page.on("requestfailed", (request) => diagnostics.push(`requestfailed:${request.url()}:${request.failure()?.errorText}`));
page.on("response", (response) => {
  if (response.status() >= 400) diagnostics.push(`response:${response.status()}:${response.url()}`);
});

await page.goto(`${baseUrl}/admin?qa=${Date.now()}`, {
  waitUntil: "domcontentloaded",
  timeout: 10_000,
});
await page.waitForTimeout(2500);
await page.getByLabel("后台密码").fill(process.env.ADMIN_PASSWORD || "");

let loginStatus = null;
try {
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/admin/login"),
    { timeout: 6000 },
  );
  await page.getByRole("button", { name: /进入后台/ }).click();
  loginStatus = (await responsePromise).status();
} catch (error) {
  diagnostics.push(`login:${error.message}`);
}

await page.waitForTimeout(1000);
console.log(JSON.stringify({
  url: page.url(),
  loginStatus,
  publisherVisible: await page.locator(".publisher-form").isVisible().catch(() => false),
  loginFormVisible: await page.locator(".admin-login form").isVisible().catch(() => false),
  errorText: await page.locator(".form-error").textContent().catch(() => null),
  diagnostics,
}, null, 2));

await browser.close();
