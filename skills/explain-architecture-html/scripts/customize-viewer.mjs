import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readPresentation } from "./presentation.mjs";

const [toolPath, candidatePath, rolesPath, presentationPath] =
  process.argv.slice(2);
if (!presentationPath)
  throw new Error(
    "Usage: node customize-viewer.mjs <archify-checkout> <candidate.json> <module-guide.json> <presentation.json>",
  );
const upstream = path.resolve(toolPath);
const toolchain = JSON.parse(
  fs.readFileSync(new URL("./toolchain.json", import.meta.url), "utf8"),
);
const revision = execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (revision !== toolchain.archify.revision)
  throw new Error(
    "Unsupported Archify revision; update and verify the adapter before using another version.",
  );
const presentation = readPresentation(presentationPath);
const readOriginal = (file) =>
  execFileSync("git", ["-C", upstream, "show", `HEAD:${file}`], {
    encoding: "utf8",
    maxBuffer: 4_000_000,
  });
const replaceOnce = (source, find, replacement) => {
  if (!source.includes(find))
    throw new Error(`Missing upstream marker: ${find.slice(0, 100)}`);
  return source.replace(find, replacement);
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const roles = JSON.parse(fs.readFileSync(rolesPath, "utf8"));
const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
for (const node of candidate.components) {
  if (
    !Object.hasOwn(roles, node.id) ||
    typeof roles[node.id].role !== "string" ||
    typeof roles[node.id].business !== "string"
  )
    throw new Error(`Missing role or business stage: ${node.id}`);
}
let template = readOriginal("archify/assets/template.html");
const japanese =
  "'Yu Gothic', Meiryo, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif";
template = template.replaceAll(
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans', Roboto, 'Helvetica Neue', Arial, sans-serif",
  japanese,
);
template = template.replaceAll(
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', 'Noto Sans Mono CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', monospace",
  japanese,
);
template = template.replaceAll(
  "'Songti SC', STSong",
  "'Yu Mincho', 'Hiragino Mincho ProN'",
);
template = replaceOnce(
  template,
  "</style>",
  `
    .ah-return { display:inline-block; color:var(--text); margin:0 0 1rem; font-size:14px; text-underline-offset:3px; }
    .ah-instructions { font-size:14px; color:var(--text-muted); line-height:1.7; margin:0 0 1rem; }
    .ah-role { margin:.4rem 0; font-size:12px; line-height:1.7; color:var(--text); }
    .ah-role-stage { color:var(--frontend-stroke); font-size:11px; margin:.25rem 0; line-height:1.6; }
    .ah-reach-help { margin:.4rem 0; font-size:11px; line-height:1.7; color:var(--text-muted); }
    .ah-reach-help summary, #focus-evidence > summary { cursor:pointer; color:var(--text); }
    #focus-evidence > summary { font-size:11px; padding:.4rem 0; }
    #focus-evidence { border-top:1px solid var(--toolbar-border); margin-top:.5rem; }
    #focus-evidence .semantic-passport-evidence-head { margin-top:.4rem; }
    .ah-modules { margin:1.5rem 0; padding:1.25rem; background:var(--panel); border:1px solid var(--border); border-radius:12px; }
    .ah-modules h2 { font-size:18px; margin:0 0 .7rem; }
    .ah-module-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.9rem 1.25rem; }
    .ah-module-grid article { min-width:0; }
    .ah-module-grid h3 { font-size:14px; margin:0 0 .25rem; }
    .ah-module-grid p { font-size:13px; line-height:1.7; color:var(--text-muted); }
    .ah-module-grid a { color:var(--text); text-underline-offset:3px; }
    @media(max-width:720px) { .ah-module-grid { grid-template-columns:1fr; } .ah-return { max-width:55%; } }
  </style>`,
);
template = replaceOnce(
  template,
  "    <!-- Header -->",
  `    <a class="ah-return" href="${escape(presentation.backHref)}">← 説明ページへ戻る</a>\n    <!-- Header -->`,
);
template = replaceOnce(
  template,
  "    <!-- ARCHIFY:SOURCE_EVIDENCE_DATA -->",
  '    <p class="ah-instructions">ノードを選ぶと、業務での役割と接続先を確認できます。画面下には各モジュールの責務をまとめています。</p>\n    <!-- ARCHIFY:SOURCE_EVIDENCE_DATA -->',
);
template = replaceOnce(
  template,
  '            <span class="semantic-passport-detail" id="focus-detail" hidden></span>',
  '            <span class="semantic-passport-detail" id="focus-detail" hidden></span>\n            <p class="ah-role" id="focus-role" hidden></p>\n            <p class="ah-role-stage" id="focus-role-stage" hidden></p>',
);
const evidenceStart = template.indexOf(
  '            <div class="semantic-passport-evidence" id="focus-evidence"',
);
const evidenceEnd = template.indexOf(
  '            <span class="relationship-lens-summary"',
  evidenceStart,
);
if (evidenceStart < 0 || evidenceEnd < 0)
  throw new Error("Source evidence block not found");
let evidence = template.slice(evidenceStart, evidenceEnd).trim();
evidence = evidence
  .replace(
    '<div class="semantic-passport-evidence"',
    '<details class="semantic-passport-evidence"',
  )
  .replace(/<\/div>\s*$/, "</details>");
evidence = evidence.replace(
  /(<details[^>]+>)/,
  "$1\n              <summary>根拠コードを開く</summary>",
);
template = template.slice(0, evidenceStart) + template.slice(evidenceEnd);
template = replaceOnce(
  template,
  '        <div class="relationship-lens-list" id="relationship-lens-list" aria-label="{{i18n:viewer.passport.relations.list}}"></div>',
  `        <div class="relationship-lens-list" id="relationship-lens-list" aria-label="{{i18n:viewer.passport.relations.list}}"></div>\n        ${evidence}`,
);
const help = `<details class="ah-reach-help"><summary>直接接続と上流・下流の違い</summary><p><b>Outgoing（直接出力）</b>は、このノードから1本の矢印でつながる相手です。<b>Incoming（直接入力）</b>は、このノードへ1本の矢印でつながる相手です。</p><p><b>Downstream（下流）</b>は、矢印を出力側へ何段かたどって到達できる全ノードです。<b>Upstream（上流）</b>は、入力側へさかのぼって到達できる全ノードです。起点自身は含めず、同じノードを重複して数えません。</p><p>例：A → B → C。BはAの直接出力です。BとCはAの下流に含まれます。集計対象は、この図に描かれた接続です。</p></details>`;
template = replaceOnce(
  template,
  '              <small class="semantic-passport-reach-status"',
  `              ${help}\n              <small class="semantic-passport-reach-status"`,
);
template = replaceOnce(
  template,
  "      function renderPassport(id, node) {",
  `      var ahModuleRoles = ${JSON.stringify(roles).replaceAll("<", "\\u003c")};\n      function renderPassport(id, node) {\n        var ahRole = ahModuleRoles[id];\n        setPassportValue(document.getElementById('focus-role'), ahRole && ahRole.role);\n        setPassportValue(document.getElementById('focus-role-stage'), ahRole && ('関わる業務：' + ahRole.business));\n        evidence.open = false;`,
);
template = replaceOnce(
  template,
  "        detail.textContent = '';",
  "        setPassportValue(document.getElementById('focus-role'), '');\n        setPassportValue(document.getElementById('focus-role-stage'), '');\n        detail.textContent = '';",
);
const modules = candidate.components
  .filter((n) => roles[n.id])
  .map(
    (n) =>
      `<article><h3><a href="#focus=${escape(n.id)}" onclick="window.scrollTo(0, 0)">${escape(n.label)}</a></h3><p>${escape(roles[n.id].role)}</p></article>`,
  )
  .join("\n");
template = replaceOnce(
  template,
  "    <!-- ARCHIFY:CARDS_SLOT_START -->",
  `    <section class="ah-modules" aria-labelledby="ah-module-title"><h2 id="ah-module-title">図に描いたモジュールの役割</h2><div class="ah-module-grid">${modules}</div></section>\n    <!-- ARCHIFY:CARDS_SLOT_START -->`,
);
fs.writeFileSync(path.join(upstream, "archify/assets/template.html"), template);

let i18n = readOriginal("archify/renderers/shared/i18n.mjs");
const labels = {
  "viewer.passport.eyebrow": "モジュールの役割と接続",
  "viewer.passport.reach": "複数段先までの接続",
  "viewer.passport.upstream": "上流",
  "viewer.passport.downstream": "下流",
  "viewer.passport.relations": "直接接続",
  "viewer.passport.verified": "参照したソース",
  "viewer.passport.relationship.summary":
    "{out} 本の直接出力 · {in} 本の直接入力{loops}",
  "viewer.passport.relationship.group.out": "直接出力（Outgoing）",
  "viewer.passport.relationship.group.in": "直接入力（Incoming）",
  "viewer.passport.relationship.group.loop": "自分自身への接続",
  "viewer.passport.relationship.direction.out": "出力 →",
  "viewer.passport.relationship.direction.in": "← 入力",
};
for (const [key, value] of Object.entries(labels)) {
  const line = i18n
    .split("\n")
    .find((line) => line.trimStart().startsWith(`'${key}': [`));
  if (!line) throw new Error(`Missing catalog key ${key}`);
  const comma = line.indexOf(", ", line.indexOf(": ["));
  i18n = i18n.replace(
    line,
    line.slice(0, line.indexOf(": [") + 3) +
      JSON.stringify(value) +
      line.slice(comma),
  );
}
fs.writeFileSync(
  path.join(upstream, "archify/renderers/shared/i18n.mjs"),
  i18n,
);
console.log(
  "Task-local viewer: Japanese fonts, return link, module roles, reach help and collapsed source details applied.",
);
