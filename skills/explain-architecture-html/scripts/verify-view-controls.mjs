import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyViewControls({ browser, page, folder, evidence, config, result, check }) {
  const main = pathToFileURL(path.join(folder, config.backHref.split('#')[0])).href;
  const diagram = pathToFileURL(path.join(folder, config.diagramHref.split('#')[0])).href;
  const settle = async () => {
    await page.waitForSelector('html[data-ah-ready="true"]');
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (let i = 0; i < 5; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    });
  };
  const openSettings = async () => {
    if (!await page.locator('#ah-display').evaluate(n => n.open)) await page.locator('#ah-display summary').click();
  };
  const expectState = async (mode) => {
    await settle();
    check(await page.getAttribute('html', 'data-ah-mode') === mode, `Expected shared mode ${mode}`);
    check(await page.locator('#ah-design').count() === 0, 'Removed design selector still present');
    check(!new URL(page.url()).searchParams.has('viewDesign'), 'Legacy design remains in URL');
    const diagramPage = await page.getAttribute('html', 'data-ah-page') === 'diagram';
    check(await page.getAttribute('html', diagramPage ? 'data-preset' : 'data-theme') === (diagramPage ? 'classic' : 'shadcn'), 'Legacy design changed standard presentation');
  };
  result.controls = { stages: [], persistence: [], exports: [] };
  await page.goto(main);
  await settle();
  check(!await page.locator('.am-toolbar').isVisible(), 'Legacy explanation toolbar still visible');
  await openSettings();
  check(await page.locator('#ah-design').count() === 0, 'Unexpected design selector');
  await page.locator('#ah-mode').selectOption('dark');
  await page.reload();
  await expectState('dark');
  await page.locator('.ah-detail-link').click();
  await expectState('dark');
  check(await page.getAttribute('html', 'data-theme') === 'dark', 'Diagram did not inherit dark mode');
  check(await page.getAttribute('html', 'data-preset') === 'classic', 'Diagram did not use standard design');
  await page.reload();
  await expectState('dark');
  await openSettings();
  await page.locator('#ah-mode').selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectState('light');
  check(await page.getAttribute('html', 'data-theme') === 'light', 'Explicit light mode followed system dark');
  await page.locator('#ah-mode').selectOption('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expectState('dark');
  check(await page.getAttribute('html', 'data-theme') === 'dark', 'Explicit dark mode followed system light');
  result.controls.persistence.push('explicit mode survives system changes');
  await page.locator('.ah-return').click();
  await expectState('dark');
  check(new URL(page.url()).hash === new URL(config.backHref, main).hash, 'Return fragment lost');
  result.controls.persistence.push('reload and round trip');

  await openSettings();
  await page.locator('#ah-mode').selectOption('auto');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectState('auto');
  const darkBackground = await page.locator('body').evaluate(n => getComputedStyle(n).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  await settle();
  check(await page.locator('body').evaluate(n => getComputedStyle(n).backgroundColor) !== darkBackground, 'Automatic explainer mode ignores system changes');
  await page.locator('.ah-detail-link').click();
  await expectState('auto');
  await page.emulateMedia({ colorScheme: 'dark' });
  await settle();
  check(await page.getAttribute('html', 'data-theme') === 'dark', 'Automatic diagram mode ignores system changes');
  await page.emulateMedia({ colorScheme: 'light' });
  await settle();
  check(await page.getAttribute('html', 'data-theme') === 'light', 'Automatic diagram mode stays dark');
  await page.keyboard.press('t');
  await expectState('dark');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('s');
    await expectState('dark');
  }
  check(await page.locator('[data-preset-value="signal-flow"], [data-preset-value="blueprint"], [data-preset-value="editorial"]').count() === 0, 'Removed presets still available');
  await page.keyboard.press('?');
  check(await page.locator('#diagram-guide').isVisible(), 'Diagram guide did not open');
  check(!await page.locator('.diagram-guide-shortcuts').innerText().then(text => /\bS\b/.test(text)), 'Guide advertises removed style shortcut');
  await page.keyboard.press('s');
  check(await page.locator('#diagram-guide').isVisible(), 'Removed S shortcut still closes guide');
  await page.keyboard.press('Escape');
  await page.evaluate(({ mainFile, diagramFile }) => {
    const key = 'ah-view:' + new URL('.', location.href).href + ':' + mainFile + ':' + diagramFile;
    localStorage.setItem(key, JSON.stringify({ mode: 'dark', design: 'blueprint' }));
  }, { mainFile: config.backHref.split('#')[0], diagramFile: config.diagramHref.split('#')[0] });
  await page.goto(diagram + '?viewDesign=blueprint');
  await expectState('dark');
  result.controls.persistence.push('system preference, T shortcut, removed S shortcut and legacy design settings');

  for (const width of [1440, 1280, 986, 790, 760, 721, 552, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(diagram + '?viewMode=light&viewDesign=standard');
    await settle();
    const viewBox = await page.locator('.diagram-container > svg').getAttribute('viewBox');
    const title = await page.locator('h1').boundingBox();
    const header = await page.locator('.ah-controls').boundingBox();
    check(title.y >= header.y + header.height - 1, `Diagram title overlaps controls at ${width}`);
    await openSettings();
    const menu = await page.locator('#ah-display .ah-settings-panel').boundingBox();
    check(menu.x >= 0 && menu.x + menu.width <= width + 1, `Settings outside viewport at ${width}`);
    await page.locator('#ah-present').click();
    await settle();
    const svg = await page.locator('.diagram-container > svg').boundingBox();
    const stageHeader = await page.locator('.ah-controls').boundingBox();
    check(svg.height > 100 && svg.width > 100, `Collapsed presentation diagram at ${width}`);
    check(svg.y >= stageHeader.y + stageHeader.height && svg.y + svg.height <= 901, `Presentation diagram outside available height at ${width}: ${JSON.stringify({ svg, header: stageHeader })}`);
    check(await page.locator('#ah-exit').isVisible(), `Missing stage exit at ${width}`);
    check(!await page.locator('.ah-modules').isVisible(), `Module list consumes stage at ${width}`);
    check(await page.locator('.diagram-container > svg').getAttribute('viewBox') === viewBox, 'Presentation changed SVG geometry');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow in stage at ${width}`);
    if ([1440, 390].includes(width)) {
      await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(evidence, `stage-${width}.png`) });
    }
    await page.reload();
    await settle();
    check(await page.locator('.diagram-container > svg').evaluate(n => n.getBoundingClientRect().height > 100), 'Reload collapsed stage');
    await page.locator('#ah-exit').click();
    await settle();
    check(await page.locator('.ah-modules').isVisible(), 'Exit did not restore module list');
    check(!await page.locator('#ah-exit').isVisible(), 'Stage exit did not reset');
    result.controls.stages.push({ width, svgHeight: svg.height });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(diagram + '?viewMode=light&viewDesign=standard');
  await settle();
  await page.keyboard.press('f');
  await settle();
  check(await page.locator('#ah-exit').isVisible(), 'F did not enter stage');
  await page.keyboard.press('Escape');
  await settle();
  check(!await page.locator('#ah-exit').isVisible(), 'Escape did not exit stage');
  await openSettings();
  await page.keyboard.press('Escape');
  check(!await page.locator('#ah-display').evaluate(n => n.open), 'Escape did not close settings');
  check(await page.locator('#ah-display summary').evaluate(n => n === document.activeElement), 'Settings did not return focus');
  await openSettings();
  await page.keyboard.press('e');
  await settle();
  check(!await page.locator('#ah-display').evaluate(n => n.open) && await page.locator('#export-menu').isVisible(), 'E opens overlapping menus');
  await page.keyboard.press('Escape');
  await openSettings();
  await page.locator('#btn-export').focus();
  await page.keyboard.press('ArrowDown');
  await settle();
  check(!await page.locator('#ah-display').evaluate(n => n.open) && await page.locator('#export-menu').isVisible(), 'ArrowDown opens overlapping menus');
  await page.keyboard.press('Escape');
  await openSettings();
  await page.locator('#btn-export').click();
  check(!await page.locator('#ah-display').evaluate(n => n.open), 'Output and settings overlap');
  for (const width of [1440, 721, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await settle();
    if (!await page.locator('#export-menu').isVisible()) await page.locator('#btn-export').click();
    const menu = await page.locator('#export-menu').boundingBox();
    check(menu.x >= 0 && menu.x + menu.width <= width + 1, `Export menu outside viewport at ${width}`);
    check(menu.y >= 0 && menu.y + menu.height <= 901, `Export menu outside viewport height at ${width}`);
    check(await page.locator('#export-menu button strong').evaluateAll(nodes => nodes.filter(n => n.closest('button').getBoundingClientRect().height > 0).every(n => {
      const r = n.getBoundingClientRect();
      return r.width > 16 && r.height > 8;
    })), `Export format labels collapsed at ${width}`);
    check(await page.locator('#export-menu button:disabled').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height === 0)), `Unavailable exports visible at ${width}`);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(evidence, `common-output-${width}.png`) });
  }
  for (const [width, height] of [[390, 844], [844, 390], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await settle();
    if (!await page.locator('#export-menu').isVisible()) await page.locator('#btn-export').click();
    const menu = await page.locator('#export-menu').boundingBox();
    check(menu.x >= 0 && menu.x + menu.width <= width + 1 && menu.y >= 0 && menu.y + menu.height <= height + 1, `Export menu outside ${width}x${height} viewport`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const downloadSvg = page.waitForEvent('download');
  await page.locator('[data-format="svg-dark"]').click();
  const svgDownload = await downloadSvg;
  await svgDownload.saveAs(path.join(evidence, 'diagram-dark.svg'));
  const exportedSvg = fs.readFileSync(path.join(evidence, 'diagram-dark.svg'), 'utf8');
  check(exportedSvg.includes('<svg') && exportedSvg.includes('data-node-id='), 'SVG export lost diagram');
  check(!exportedSvg.includes('data-focus-active=') && !exportedSvg.includes('data-present='), 'Export contains transient viewer state');
  result.controls.exports.push('SVG download');
  await page.locator('#btn-export').click();
  const downloadPng = page.waitForEvent('download');
  await page.locator('[data-format="png"]').click();
  const pngDownload = await downloadPng;
  await pngDownload.saveAs(path.join(evidence, 'diagram.png'));
  check(fs.readFileSync(path.join(evidence, 'diagram.png')).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid PNG export');
  result.controls.exports.push('PNG download');
  await page.goto(main + '?viewMode=light&viewDesign=standard');
  await settle();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.ahCopiedText = text; } } });
  });
  await page.locator('#ah-output summary').click();
  await page.locator('#ah-copy').click();
  await page.waitForFunction(() => window.ahCopiedText === document.getElementById('am-source').value);
  result.controls.exports.push('source copy');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(evidence, 'common-header-1440.png') });
  await page.setViewportSize({ width: 721, height: 884 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence, 'common-header-721.png') });
  const alignment = await page.locator('.ah-controls :is(nav a, summary, #btn-export)').evaluateAll(nodes => nodes.map(n => {
    const box = n.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(n);
    const text = range.getBoundingClientRect();
    return { label: n.textContent, height: box.height, offset: (text.top + text.bottom - box.top - box.bottom) / 2 };
  }));
  check(alignment.every(n => n.height <= 40 && Math.abs(n.offset) <= 3), 'Header text is not vertically centered in compact controls');
  result.controls.headerAlignment = alignment;
  await openSettings();
  await page.screenshot({ path: path.join(evidence, 'common-settings-721.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await openSettings();
  await page.screenshot({ path: path.join(evidence, 'common-settings-390.png') });

  const blocked = await browser.newContext({ colorScheme: 'light' });
  try {
    await blocked.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } }); });
    const isolated = await blocked.newPage();
    isolated.on('pageerror', error => result.runtimeErrors.push(error.message));
    await blocked.route(/^https?:/, route => route.abort());
    await isolated.goto(main);
    await isolated.waitForSelector('html[data-ah-ready="true"]');
    await isolated.locator('#ah-display summary').click();
    await isolated.locator('#ah-mode').selectOption('dark');
    await isolated.reload();
    await isolated.waitForSelector('html[data-ah-ready="true"]');
    check(await isolated.getAttribute('html', 'data-ah-mode') === 'dark', 'Blocked storage loses reload state');
    await isolated.locator('.ah-detail-link').click();
    await isolated.waitForSelector('html[data-ah-ready="true"]');
    check(await isolated.getAttribute('html', 'data-ah-mode') === 'dark' && await isolated.getAttribute('html', 'data-preset') === 'classic', 'Blocked storage loses navigation state');
    await isolated.locator('.ah-return').click();
    await isolated.waitForSelector('html[data-ah-ready="true"]');
    check(await isolated.getAttribute('html', 'data-ah-mode') === 'dark', 'Blocked storage loses return state');
    result.controls.persistence.push('storage unavailable');
  } finally { await blocked.close(); }
  await page.goto(diagram);
  await settle();
}
