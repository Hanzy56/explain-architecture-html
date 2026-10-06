import { escapeHtml } from './presentation.mjs';

// Both generators inline this module's output: delivered pages remain standalone.
function bootstrap(config) {
  const root = document.documentElement;
  root.setAttribute('data-ah-page', config.kind);
  const modes = ['auto', 'light', 'dark'];
  const params = new URLSearchParams(location.search);
  const key = 'ah-view:' + new URL('.', location.href).href + ':' + config.main + ':' + config.diagram;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) {}
  const legacyTheme = params.get('theme');
  const mode = params.get('viewMode') || (['light', 'dark'].includes(legacyTheme) ? legacyTheme : null) || saved.mode;
  const state = {
    mode: modes.includes(mode) ? mode : 'auto',
  };
  const system = matchMedia('(prefers-color-scheme: dark)');
  const effective = () => state.mode === 'auto' ? (system.matches ? 'dark' : 'light') : state.mode;
  function paint() {
    root.setAttribute('data-ah-mode', state.mode);
    root.removeAttribute('data-ah-design');
    if (config.kind === 'diagram') {
      root.setAttribute('data-theme', effective());
      root.setAttribute('data-preset', 'classic');
    } else {
      root.setAttribute('data-mode', state.mode);
      root.setAttribute('data-theme', 'shadcn');
    }
  }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) {}
    // file: storage may be per-file or unavailable. Keep reloads and local links reliable.
    try {
      const url = new URL(location.href);
      url.searchParams.set('viewMode', state.mode);
      url.searchParams.delete('viewDesign');
      history.replaceState(null, '', url.href);
    } catch (_) {}
  }
  function set(next) {
    if (modes.includes(next.mode)) state.mode = next.mode;
    paint();
    persist();
    document.dispatchEvent(new Event('ah-view-change'));
  }
  window.AhView = { state, set, paint, effective };
  paint();
  persist();
  const change = () => { paint(); document.dispatchEvent(new Event('ah-view-change')); };
  if (system.addEventListener) system.addEventListener('change', change);
  else system.addListener(change);
}

function bindControls(config) {
  const root = document.documentElement;
  const header = document.querySelector('.ah-controls');
  const settings = document.getElementById('ah-display');
  const mode = document.getElementById('ah-mode');
  const output = document.getElementById('ah-output');
  const present = document.getElementById('ah-present');
  const exit = document.getElementById('ah-exit');
  const motion = document.getElementById('ah-motion');
  const view = window.AhView;
  const diagram = config.kind === 'diagram';
  const api = diagram ? window.Archify : null;
  if (diagram) {
    // Retain the upstream export implementation and its keyboard/download behavior.
    const exports = document.querySelector('.ah-native-controls .export-wrap');
    if (!exports) throw new Error('Missing native diagram export controls');
    output.replaceWith(exports);
    const trigger = document.getElementById('btn-export');
    trigger.textContent = 'コピー・出力 ▾';
    trigger.setAttribute('aria-label', 'コピー・出力');
    trigger.title = 'コピー・出力 (E)';
    // Export also opens through E, arrow keys and the diagram guide.
    new MutationObserver(() => {
      if (trigger.getAttribute('aria-expanded') === 'true') settings.open = false;
    }).observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] });
  }
  const disclosures = [...header.querySelectorAll('details')];
  disclosures.forEach(item => item.addEventListener('toggle', () => {
    if (!item.open) return;
    disclosures.forEach(other => { if (other !== item) other.open = false; });
    if (api?.exportMenu?.isOpen()) api.exportMenu.close(false);
  }));
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) disclosures.forEach(item => { item.open = false; });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = disclosures.find(item => item.open);
    if (!open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open.open = false;
    open.querySelector('summary').focus();
  }, true);
  function sync() {
    mode.value = view.state.mode;
    if (diagram) {
      const active = root.getAttribute('data-present') === 'true';
      exit.hidden = !active;
      present.textContent = active ? '通常表示に戻る' : '図に集中';
      present.setAttribute('aria-pressed', String(active));
      motion.hidden = root.getAttribute('data-motion-capable') !== 'true';
      const live = root.getAttribute('data-motion') === 'live';
      motion.textContent = live ? '動きを止める' : '動きを再開する';
      motion.setAttribute('aria-pressed', String(live));
      motion.disabled = !!document.getElementById('btn-motion')?.disabled;
      if (motion.disabled) motion.title = '端末の「動きを減らす」設定に従っています';
      else motion.removeAttribute('title');
    }
    const folder = new URL('.', location.href).href;
    document.querySelectorAll('a[href]').forEach(link => {
      const raw = link.getAttribute('href');
      if (!raw || raw.startsWith('#')) return;
      try {
        const url = new URL(raw, location.href);
        if (new URL('.', url).href !== folder || !url.pathname.endsWith('.html')) return;
        url.searchParams.set('viewMode', view.state.mode);
        url.searchParams.delete('viewDesign');
        link.href = url.href;
      } catch (_) {}
    });
  }
  mode.addEventListener('change', () => view.set({ mode: mode.value }));
  if (diagram) {
    function toggleStage() {
      settings.open = false;
      api.presentation.toggle();
    }
    present.addEventListener('click', toggleStage);
    exit.addEventListener('click', () => {
      api.presentation.exit();
      settings.querySelector('summary').focus();
    });
    motion.addEventListener('click', () => api.motionGovernor.toggle());
    // Theme and focus shortcuts still flow through upstream controllers.
    new MutationObserver(() => {
      const next = {};
      const theme = root.getAttribute('data-theme');
      if (['light', 'dark'].includes(theme) && theme !== view.effective()) next.mode = theme;
      if (Object.keys(next).length) view.set(next);
      sync();
    }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-present', 'data-motion', 'data-motion-capable'] });
    api.preset.apply('classic');
  } else {
    document.getElementById('ah-copy').addEventListener('click', () => {
      document.querySelector('[data-am="copy"]').click();
    });
    const nativeCopy = document.querySelector('[data-am="copy"]');
    new MutationObserver(() => {
      document.getElementById('ah-copy').textContent = nativeCopy.textContent;
    }).observe(nativeCopy, { childList: true, characterData: true, subtree: true });
  }
  document.addEventListener('ah-view-change', sync);
  sync();
  root.setAttribute('data-ah-ready', 'true');
}

const css = String.raw`
html[data-ah-page] .ah-controls {
  --ah-ink: var(--ink, var(--text)); --ah-paper: var(--paper, var(--panel));
  --ah-line: var(--line-2, var(--panel-border)); --ah-accent: var(--accent, var(--frontend-stroke));
  position: relative; inset: auto; z-index: 40; display: flex; flex-wrap: wrap;
  align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; margin: 0 0 16px; padding: 0 0 8px;
  border-bottom: 1px solid var(--ah-line); color: var(--ah-ink);
  font: 14px/1.5 'Yu Gothic', Meiryo, 'Noto Sans JP', sans-serif;
  grid-column: 1 / -1; flex: none;
}
.ah-controls nav, .ah-controls .ah-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ah-controls .ah-actions { margin-left: auto; }
html[data-ah-page] .ah-controls nav a,
html[data-ah-page] .ah-controls summary,
html[data-ah-page] .ah-controls button {
  position: relative; display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; width: auto; min-height: 36px; margin: 0; padding: 6px 12px;
  border: 1px solid var(--ah-line); border-radius: 8px;
  color: var(--ah-ink); background: var(--ah-paper); font: inherit;
  line-height: 20px; text-decoration: none; cursor: pointer; letter-spacing: normal;
}
html[data-ah-page] .ah-controls button::before,
html[data-ah-page] .ah-controls button::after { content: none; }
html[data-ah-page] .ah-controls [hidden] { display: none !important; }
.ah-controls nav a[aria-current="page"] { border-color: var(--ah-accent) !important; font-weight: 700; }
.ah-controls summary { list-style: none; }
.ah-controls summary::-webkit-details-marker { display: none; }
.ah-controls :is(a, button, summary, select):focus-visible { outline: 3px solid var(--ah-accent); outline-offset: 2px; }
.ah-controls .ah-settings-panel {
  position: absolute; right: 0; top: calc(100% - 8px); z-index: 45;
  display: grid; gap: 16px; width: min(320px, 100%); padding: 18px;
  max-height: calc(100dvh - 160px); overflow: auto;
  border: 1px solid var(--ah-line); border-radius: 10px; background: var(--ah-paper);
  box-shadow: 0 12px 32px #0002;
}
.ah-controls .ah-settings-panel label { display: grid; gap: 6px; font-weight: 600; }
.ah-controls .ah-settings-panel select { min-height: 36px; width: 100%; padding: 6px 8px; border: 1px solid var(--ah-line); border-radius: 6px; color: var(--ah-ink); background: var(--ah-paper); font: inherit; }
html[data-ah-page] .ah-controls #btn-export { color: var(--ah-ink); }
html[data-ah-page] .ah-controls .export-wrap { position: relative; }
html[data-ah-page] .ah-controls .export-menu { position: absolute; top: calc(100% + 8px); right: 0; left: auto; bottom: auto; width: min(360px, calc(100vw - 48px)); max-height: calc(100dvh - 160px); overflow: auto; }
html[data-ah-page] .ah-controls .export-menu button { display: grid; min-height: 36px; padding: 6px 10px; text-align: left; grid-template-columns: minmax(0, 1fr); }
html[data-ah-page] .ah-controls .export-menu button:disabled { display: none; }
html[data-ah-page] .ah-controls .export-menu-section:not(:has(button:not([hidden]):not(:disabled))) { display: none; }
html[data-ah-page="explainer"] .am-head { padding-right: 0; }
html[data-ah-page="explainer"] .am-toolbar { display: none !important; }
html[data-ah-page="diagram"] .header { padding-right: 0 !important; }
html[data-ah-page="diagram"] .ah-native-controls { display: none !important; }
html[data-ah-page][data-embed="true"] .ah-controls { display: none; }
html[data-ah-page][data-present="true"]:not([data-embed="true"]) .ah-controls { position: relative; inset: auto; margin: 0; }
html[data-ah-page][data-present="true"]:not([data-embed="true"]) :is(.ah-instructions, .ah-modules, .reader-rail) { display: none !important; }
html[data-ah-page][data-present="true"]:not([data-embed="true"]) .header { padding: 0 !important; min-height: 0; }
html[data-ah-page][data-present="true"]:not([data-embed="true"]) .container { gap: 12px; }
html[data-ah-page][data-present="true"]:not([data-embed="true"]) .diagram-container[data-wide-diagram="true"] > svg { width: 100%; height: 100%; min-width: 0; }
@media (max-width: 600px) {
  html[data-ah-page] .ah-controls { gap: 8px; }
  .ah-controls nav { width: 100%; }
  html[data-ah-page] .ah-controls :is(nav a, summary, button) { font-size: 13px; padding: 6px 10px; }
  .ah-controls .ah-settings-panel { max-height: calc(100dvh - 220px); }
  html[data-ah-page] .ah-controls .export-menu { max-height: calc(100dvh - 220px); }
}
@media print { html[data-ah-page] .ah-controls { display: none !important; } }
`;

export function sharedControls(presentation, kind) {
  const config = { kind, main: presentation.backHref.split('#')[0], diagram: presentation.diagramHref.split('#')[0] };
  const serialized = JSON.stringify(config).replaceAll('<', '\\u003c');
  const current = (page) => kind === page ? ' aria-current="page"' : '';
  const header = `<header class="ah-controls toolbar" aria-label="ページと表示の操作">
  <nav aria-label="ページ切替"><a class="ah-return" href="${escapeHtml(presentation.backHref)}"${current('explainer')}>説明</a><a href="${escapeHtml(presentation.diagramHref)}"${current('diagram')}>詳細アーキテクチャ</a></nav>
  <div class="ah-actions">
    ${kind === 'diagram' ? '<button id="ah-exit" type="button" hidden>通常表示に戻る</button>' : ''}
    <details id="ah-display"><summary>表示設定 ▾</summary><div class="ah-settings-panel">
      <label for="ah-mode">明暗<select id="ah-mode"><option value="auto">自動</option><option value="light">ライト</option><option value="dark">ダーク</option></select></label>
      ${kind === 'diagram' ? '<button id="ah-present" type="button" aria-pressed="false">図に集中</button><button id="ah-motion" type="button" hidden>動きを止める</button>' : ''}
    </div></details>
    ${kind === 'diagram' ? '<div id="ah-output"></div>' : '<details id="ah-output"><summary>コピー・出力 ▾</summary><div class="ah-settings-panel"><button id="ah-copy" type="button">原稿をコピー</button></div></details>'}
  </div>
</header>`;
  return {
    bootstrap: `<script id="ah-view-bootstrap">(${bootstrap.toString()})(${serialized});</script>`,
    style: `<style id="ah-view-controls">${css}</style>`,
    header,
    runtime: `<script id="ah-view-runtime">(${bindControls.toString()})(${serialized});</script>`,
  };
}
