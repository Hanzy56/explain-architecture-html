import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readPresentation } from "./presentation.mjs";
import { verifyViewControls } from './verify-view-controls.mjs';

const [outputPath, modulesPath, channel] = process.argv.slice(2);
if (!outputPath)
  throw new Error(
    "Usage: node verify-pages.mjs <output-directory> [playwright-module-directory] [browser-channel]",
  );
const folder = path.resolve(outputPath);
const config = readPresentation(path.join(folder, "presentation.json"));
const playwright = modulesPath
  ? createRequire(path.join(path.resolve(modulesPath), "_entry.cjs"))(
      "playwright",
    )
  : await import("playwright");
const evidence = path.join(folder, "browser-check");
fs.mkdirSync(evidence, { recursive: true });
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hash = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const mainFile = config.backHref.split("#")[0];
const diagramFile = config.diagramHref.split("#")[0];
const result = {
  status: "pass",
  files: {
    index: hash(path.join(folder, mainFile)),
    architecture: hash(path.join(folder, diagramFile)),
  },
  viewports: [],
  runtimeErrors: [],
  externalResourceRequests: [],
};
const browser = await playwright.chromium.launch({
  headless: true,
  ...(channel ? { channel } : {}),
});
try {
  const context = await browser.newContext({ colorScheme: 'light' });
  await context.route(/^https?:/, (route) => {
    result.externalResourceRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => result.runtimeErrors.push(error.message));
  await page.goto(pathToFileURL(path.join(folder, mainFile)).href);
  await page.waitForSelector('html[data-ah-ready="true"]');
  const normalizeNewlines = (text) => text.replace(/\r\n?/g, "\n").trim();
  check(
    normalizeNewlines(await page.locator("#am-source").inputValue()) ===
      normalizeNewlines(
        fs.readFileSync(path.join(folder, "explainer.md"), "utf8"),
      ),
    "Embedded Markdown differs from source",
  );
  check(
    (await page.locator(".am-panel").count()) > 0,
    "No explanation sections",
  );
  const links = await page.locator("a[href]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      href: node.href,
      raw: node.getAttribute("href"),
      target: node.target,
      rel: node.rel,
    })),
  );
  const external = links.filter((link) => /^https?:/.test(link.href));
  check(
    external.every(
      (link) => link.target === "_blank" && link.rel.includes("noopener"),
    ),
    "External reference does not open in a new tab safely",
  );
  for (const link of links.filter((link) => link.href.startsWith("file:")))
    check(
      fs.existsSync(fileURLToPath(new URL(link.href))),
      `Missing local link: ${link.raw}`,
    );
  const ids = await page
    .locator("[id]")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  check(
    links
      .filter((link) => link.raw.startsWith("#"))
      .every((link) => ids.includes(link.raw.slice(1))),
    "Missing section link target",
  );
  result.externalReferenceLinks = external.length;
  const card = page.locator("a.ah-detail-link");
  check((await card.count()) === 1, "Expected one main diagram card");
  check(
    new URL(await card.getAttribute('href')).pathname === new URL(config.diagramHref, page.url()).pathname,
    "Diagram card destination differs from configuration",
  );
  for (const width of [1440, 986, 790, 760, 552, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const header = await page.locator(".am-head").boundingBox();
    const intro = await page.locator(".am-intro").boundingBox();
    const heading = await page.locator(".am-head h1").boundingBox();
    const toolbar = await page.locator(".ah-controls").boundingBox();
    check(
      Math.abs(header.width - intro.width) < 1,
      `Intro width restricted at ${width}px`,
    );
    check(
      heading.y >= toolbar.y + toolbar.height ||
        heading.x + heading.width <= toolbar.x,
      `Title overlaps toolbar at ${width}px`,
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Page overflow at ${width}px`,
    );
    const bounds = await card.boundingBox();
    check(
      bounds.height >= 80 && bounds.width <= width,
      `Main diagram card unusable at ${width}px`,
    );
    result.viewports.push({
      width,
      introWidth: intro.width,
      cardHeight: bounds.height,
      pageOverflow: false,
    });
    if ([790, 390].includes(width)) {
      await page.screenshot({
        path: path.join(evidence, `header-${width}.png`),
      });
      await card.screenshot({ path: path.join(evidence, `card-${width}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#ah-display summary').click();
  await page.locator('#ah-mode').selectOption('dark');
  check(
    (await page.getAttribute("html", "data-mode")) === "dark",
    "Dark-mode switch failed",
  );
  await card.screenshot({ path: path.join(evidence, "card-dark.png") });
  await page.locator('#ah-design').selectOption('blueprint');
  check(
    (await page.getAttribute("html", "data-theme")) !== "shadcn",
    "Theme switch failed",
  );
  await card.click();
  await page.waitForURL((url) => url.pathname.endsWith("/" + diagramFile));
  await page.waitForSelector('html[data-ah-ready="true"]');
  const roles = JSON.parse(
    fs.readFileSync(path.join(folder, "module-guide.json"), "utf8"),
  );
  const spec = JSON.parse(
    fs.readFileSync(path.join(folder, "candidate.json"), "utf8"),
  );
  check(
    (await page.locator(".ah-module-grid article").count()) ===
      spec.components.length,
    "Module guide does not match components",
  );
  const first = spec.components[0];
  await page.locator(".ah-module-grid a").first().click();
  await page.waitForFunction(
    (text) => document.querySelector("#focus-role").textContent === text,
    roles[first.id].role,
  );
  check(
    await page.locator("#focus-role").evaluate((node) => {
      const r = node.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
    "Module list opens an off-screen role",
  );
  check(
    await page.locator("#focus-evidence").evaluate((node) => !node.open),
    "Source details should start collapsed",
  );
  check(
    await page.evaluate(() =>
      Boolean(
        document
          .querySelector("#relationship-lens-list")
          .compareDocumentPosition(document.querySelector("#focus-evidence")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
    "Sources precede relationships",
  );
  await page.locator(".ah-reach-help summary").click();
  check(
    (await page.locator(".ah-reach-help").innerText()).includes("1本の矢印"),
    "Missing direct/transitive connection explanation",
  );
  check(
    await page
      .locator("#focus-evidence a[href]")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => /^https?:/.test(node.href))
          .every((node) => node.target === "_blank"),
      ),
    "Dynamic source links should open in new tabs",
  );
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const document = await cdp.send("DOM.getDocument");
  const title = await cdp.send("DOM.querySelector", {
    nodeId: document.root.nodeId,
    selector: "h1",
  });
  result.titleFonts = (
    await cdp.send("CSS.getPlatformFontsForNode", { nodeId: title.nodeId })
  ).fonts;
  await page.screenshot({ path: path.join(evidence, "diagram-focus.png") });
  await verifyViewControls({ browser, page, folder, evidence, config, result, check });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Detailed diagram page overflow",
  );
  await page.locator("a.ah-return").click();
  await page.waitForURL(
    (url) =>
      url.pathname.endsWith("/" + mainFile) &&
      url.hash === new URL(config.backHref, "https://local.invalid/").hash,
  );
  result.navigation = "pass";
  check(result.runtimeErrors.length === 0, "Browser runtime errors");
  check(
    result.externalResourceRequests.length === 0,
    "Unexpected external resources",
  );
} catch (error) {
  result.status = "fail";
  result.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  fs.writeFileSync(
    path.join(evidence, "checks.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
}
