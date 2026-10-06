import fs from "node:fs";
import path from "node:path";
import { readPresentation, escapeHtml } from "./presentation.mjs";
import { sharedControls } from "./viewer-controls.mjs";
const [htmlPath, configPath] = process.argv.slice(2);
if (!configPath)
  throw new Error(
    "Usage: node present-explainer.mjs <index.html> <presentation.json>",
  );
const file = path.resolve(htmlPath);
const config = readPresentation(configPath);
const controls = sharedControls(config, 'explainer');
let html = fs.readFileSync(file, "utf8");
const presentation = `<style id="ah-explainer-presentation">
.am-head { padding-right: 0; }
.am-intro { max-width: none; }
.am-md .ah-detail-link {
  display: flex; align-items: center; gap: 20px; width: 100%;
  margin: 16px 0; padding: 20px; border: 1px solid var(--accent);
  border-radius: var(--radius); background: var(--accent-bg);
  color: var(--ink); text-decoration: none;
}
.ah-detail-link-copy { display: grid; gap: 6px; min-width: 0; }
.ah-detail-link-kicker { font-size: 12px; font-weight: 600; color: var(--accent); }
.ah-detail-link strong { font-size: 18px; line-height: 1.5; }
.ah-detail-link-description { font-size: 13px; line-height: 1.6; color: var(--ink-2); }
.ah-detail-link-arrow { flex-shrink: 0; margin-left: auto; font-size: 28px; color: var(--accent); }
.am-md .ah-detail-link:hover { box-shadow: 0 0 0 1px var(--accent); }
.am-md .ah-detail-link:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
@media (max-width: 480px) {
  .am-md .ah-detail-link { padding: 16px; gap: 12px; }
  .ah-detail-link strong { font-size: 16px; }
}
</style>`;
html = html.replace(
  /<style id="ah-explainer-presentation">[\s\S]*?<\/style>\s*/g,
  "",
);
html = html.replace("</head>", presentation + "\n</head>");
// Reapplying presentation must not duplicate the common header or its scripts.
html = html.replace(/<(script|style) id="ah-view-[^"]+">[\s\S]*?<\/\1>\s*/g, '');
html = html.replace(/<header class="ah-controls toolbar"[\s\S]*?<\/header>\s*/g, '');
html = html.replace(/<html\b([^>]*)>/, (match, attrs) => '<html' + attrs.replace(/\sdata-ah-page="[^"]*"/g, '') + ' data-ah-page="explainer">');
html = html.replace(/<div class="am-toolbar"[^>]*>/, '<div class="am-toolbar" hidden>');
html = html.replace('</head>', controls.bootstrap + controls.style + '\n</head>');
html = html.replace(/(<main\b[^>]*>)/, '$1\n' + controls.header);
html = html.replace('</body>', controls.runtime + '\n</body>');
html = html.replace(
  `<p><a href="${escapeHtml(config.diagramHref)}">${escapeHtml(config.linkTitle)}</a></p>`,
  `<p><a class="ah-detail-link" href="${escapeHtml(config.diagramHref)}"><span class="ah-detail-link-copy"><span class="ah-detail-link-kicker">${escapeHtml(config.linkKicker)}</span><strong>${escapeHtml(config.linkTitle)}</strong><span class="ah-detail-link-description">${escapeHtml(config.linkDescription)}</span></span><span class="ah-detail-link-arrow" aria-hidden="true">→</span></a></p>`,
);
if (!html.includes('class="ah-detail-link"'))
  throw new Error("Detailed diagram link not found.");
html = html.replace(
  /<a\b([^>]*\bhref="https?:\/\/[^>]+)>/g,
  (match, attributes) =>
    "<a" +
    attributes.replace(/\s+(?:target|rel)="[^"]*"/g, "") +
    ' target="_blank" rel="noopener noreferrer">',
);
html = html
  .replace(/<footer\b[^>]*class="am-colophon"[\s\S]*?<\/footer>/g, "")
  .replace(/<div\b[^>]*class="am-colophon"[\s\S]*?<\/div>/g, "");
fs.writeFileSync(file, html);
console.log(
  "Explanation: intro uses full width; main diagram link emphasized; external references open in a new tab.",
);
