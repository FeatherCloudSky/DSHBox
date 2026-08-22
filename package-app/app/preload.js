// HelloDeepseekHarness 玻璃窗口壳 — 预加载脚本(沙箱内,内嵌样式)
// 职责:向 WebUI 页面注入顶部玻璃横栏(左侧品牌、右侧悬浮胶囊按钮组),
//       按钮真实控制窗口(经 IPC),外观采用毛玻璃质感样式。
const { ipcRenderer } = require('electron');

const TITLEBAR_ID = 'dsh-lg-titlebar';
const BAR_H = 40;                    // 横栏高度(px)
let isMaximized = false;             // 全局窗口状态(重建标题栏时恢复图标)

// ================= 玻璃质感样式(内嵌,避免沙箱读文件) =================
const CSS = `
/* ===== 双层圆角嵌套窗口(毛玻璃质感):
       内容区低不透明度毛玻璃让底层透出;柔和模糊 + 细边框 + 顶部高光 ===== */
html.dsh-lg-host {
  --lg-radius: 20px;
  --lg-glass-bg: rgba(255,255,255,0.38);     /* 内容区毛玻璃底色(低不透明度,背景透出) */
  --lg-glass-blur: blur(14px) saturate(160%); /* 毛玻璃模糊参数(柔和) */
  background: transparent !important;
}
html[data-lg-theme="light"] {
  --lg-glass-bg: rgba(255,255,255,0.38);
}
html[data-lg-theme="dark"] {
  --lg-glass-bg: rgba(20,26,38,0.40);   /* 内容区保持原半透明毛玻璃 */
}
html.dsh-lg-host, html.dsh-lg-host body {
  height: 100% !important;
  overflow: hidden !important;
}
html.dsh-lg-host body {
  background: transparent !important;
}

/* ===== 标题栏:全宽玻璃胶囊(品牌左,控制右,左右等宽) ===== */
#${TITLEBAR_ID} {
  position: fixed;
  top: 8px; left: 8px; right: 8px;
  height: 36px;
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 14px;
  box-sizing: border-box;
  border-radius: 999px;   /* 胶囊形(两端全圆,Dynamic Island 风格) */
  background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.24);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  backdrop-filter: blur(18px) saturate(180%);
  box-shadow: 0 8px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.10);
  user-select: none;
  -webkit-user-select: none;
  cursor: default;
  -webkit-app-region: drag;
  --lg-icon: rgba(255,255,255,0.94);
  --lg-brand: rgba(255,255,255,0.85);
}
html[data-lg-theme="light"] #${TITLEBAR_ID} {
  --lg-icon: rgba(38,44,62,0.90);
  --lg-brand: rgba(38,44,62,0.80);
  background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(238,242,250,0.78));
  border: 1px solid rgba(140,152,180,0.32);
  box-shadow: 0 6px 20px rgba(31,38,58,0.18), inset 0 1px 0 rgba(255,255,255,0.9);
}
html[data-lg-theme="dark"] #${TITLEBAR_ID} {
  --lg-icon: rgba(255,255,255,0.94);
  --lg-brand: rgba(255,255,255,0.80);
  background: linear-gradient(180deg, rgba(20,26,38,0.74), rgba(20,26,38,0.55));
  border: 1px solid rgba(255,255,255,0.20);
  box-shadow: 0 6px 20px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.22);
}

/* 品牌区:标题栏左侧,无独立背景 */
#${TITLEBAR_ID} .dsh-lg-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--lg-brand);
  white-space: nowrap;
}
#${TITLEBAR_ID} .dsh-lg-brand .dsh-lg-logo {
  width: 15px; height: 15px;
  border-radius: 4px;
  background: linear-gradient(135deg, #6D8BFF, #4D6BFE 60%, #3B56D9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 3px rgba(77,107,254,0.45);
  display: flex; align-items: center; justify-content: center;
}
#${TITLEBAR_ID} .dsh-lg-brand .dsh-lg-logo::after {
  content: '';
  width: 7px; height: 4.5px;
  border-radius: 50% 50% 45% 45%;
  background: rgba(255,255,255,0.95);
  box-shadow: 0 -2px 0 -1px rgba(255,255,255,0.95);
  transform: translateY(-0.5px);
}
/* 非官方社区版徽标:弱化样式,仅作标识声明 */
#${TITLEBAR_ID} .dsh-lg-unofficial {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(128,128,128,0.16);
  border: 1px solid rgba(128,128,128,0.28);
  color: var(--lg-brand);
  opacity: 0.85;
}

/* 控制按钮组:标题栏内右侧,无独立背景(标题栏提供玻璃效果) */
#${TITLEBAR_ID} .dsh-lg-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

/* ===== 内容区:毛玻璃+内缩+四角圆角 =====
   内圆角保持 20px;外框圆角 = 20 + 8 = 28px(见 #dsh-lg-frame),
   弧线圆心重合、视觉等宽。 */
html.dsh-lg-host #root {
  position: fixed;
  top: 52px; left: 8px; right: 8px; bottom: 8px;
  height: auto !important;
  border-radius: var(--lg-radius);
  overflow: hidden;
  background: var(--lg-glass-bg) !important;
  -webkit-backdrop-filter: var(--lg-glass-blur);
  backdrop-filter: var(--lg-glass-blur);
  border: 1px solid rgba(255,255,255,0.18);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.30),
    inset 0 -1px 0 rgba(255,255,255,0.08),
    0 12px 32px rgba(0,0,0,0.16),
    0 3px 10px rgba(0,0,0,0.10);
}
html[data-lg-theme="dark"] #root {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.18),
    inset 0 -1px 0 rgba(0,0,0,0.25),
    0 14px 36px rgba(0,0,0,0.50),
    0 3px 10px rgba(0,0,0,0.35);
}

/* ===== 外层装饰边框:层级最低,纯色外框(mac 风:浅色米白/深色深灰) ===== */
#dsh-lg-frame {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  border-radius: calc(var(--lg-radius) + 8px);  /* 28px:内容区 20px + 内缩 8px,弧线平行 */
  border: 1px solid rgba(255,255,255,0.25);
  background: #f5f2ea;              /* 浅色:米白 */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 20px 60px rgba(0,0,0,0.12),
    0 4px 16px rgba(0,0,0,0.08);
  pointer-events: none;         /* 不拦截任何点击 */
  z-index: 0;
}

/* ===== 最大化 / 真全屏:最外层装饰边框变直角铺满(内容区/标题栏圆角保留) ===== */
html.dsh-lg-maximized #dsh-lg-frame,
html.dsh-lg-fullscreen #dsh-lg-frame {
  border-radius: 0 !important;
}
html[data-lg-theme="light"] #dsh-lg-frame {
  background: #f5f2ea;              /* 米白 */
  border-color: rgba(160,150,130,0.35);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.6),
    0 20px 60px rgba(0,0,0,0.10),
    0 4px 16px rgba(0,0,0,0.06);
}
html[data-lg-theme="dark"] #dsh-lg-frame {
  background: #2d2d2d;              /* 比 WebUI 深色背景(rgb 21,21,23)略浅的灰 */
  border-color: rgba(255,255,255,0.16);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.14),
    0 20px 60px rgba(0,0,0,0.25),
    0 4px 16px rgba(0,0,0,0.15);
}
#${TITLEBAR_ID} .dsh-lg-btn {
  -webkit-app-region: no-drag;
  width: 30px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--lg-icon);
  cursor: default;
  transition: background 0.16s ease, transform 0.1s ease, box-shadow 0.16s ease, color 0.16s ease;
  outline: none;
}
#${TITLEBAR_ID} .dsh-lg-btn svg {
  width: 13px;
  height: 13px;
  display: block;
  pointer-events: none;
}
#${TITLEBAR_ID} .dsh-lg-btn:active {
  transform: scale(0.88);
}
/* hover:强对比反馈(浅色→深底白图标;深色→亮底深图标) */
html[data-lg-theme="light"] #${TITLEBAR_ID} .dsh-lg-btn:not(.dsh-lg-close):hover {
  background: rgba(24,31,52,0.92);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(24,31,52,0.40), inset 0 1px 0 rgba(255,255,255,0.28);
  transform: scale(1.06);
}
html[data-lg-theme="dark"] #${TITLEBAR_ID} .dsh-lg-btn:not(.dsh-lg-close):hover {
  background: rgba(255,255,255,0.92);
  color: #0d1117;
  box-shadow: 0 2px 12px rgba(255,255,255,0.25), inset 0 1px 0 rgba(255,255,255,0.9);
  transform: scale(1.06);
}
/* 关闭键 hover:红色(用户认可的强反馈) */
#${TITLEBAR_ID} .dsh-lg-close:hover {
  background: var(--lg-close, rgba(255,59,48,0.95));
  color: #ffffff;
  box-shadow: 0 0 16px rgba(255,59,48,0.55), inset 0 1px 0 rgba(255,255,255,0.30);
  transform: scale(1.06);
}
@media (prefers-reduced-motion: reduce) {
  #${TITLEBAR_ID}, #${TITLEBAR_ID} .dsh-lg-btn, #${TITLEBAR_ID} .dsh-lg-controls { transition: none; }
}
`;

// ================= 图标 =================
function svg(paths, viewBox = '0 0 14 14') {
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
const ICONS = {
  minimize: svg('<path d="M2.5 7h9"/>'),
  maximize: svg('<rect x="2.2" y="2.2" width="9.6" height="9.6" rx="2"/>'),
  // 还原(双框叠放,清晰的"恢复小窗"语义)
  restore: svg('<rect x="2.4" y="4.2" width="7.4" height="7.4" rx="1.6"/><path d="M4.6 4.2V3.4a1.4 1.4 0 0 1 1.4-1.4h4.6a1.4 1.4 0 0 1 1.4 1.4v4.6a1.4 1.4 0 0 1-1.4 1.4h-0.8"/>'),
  close: svg('<path d="M3.8 3.8l6.4 6.4M10.2 3.8l-6.4 6.4"/>')
};

// ================= 横栏 DOM =================
function buildTitlebar() {
  const bar = document.createElement('div');
  bar.id = TITLEBAR_ID;
  bar.title = 'HelloDeepseekHarness — 拖拽此横栏可移动窗口,双击切换最大化';
  bar.innerHTML = `
    <div class="dsh-lg-brand"><span class="dsh-lg-logo"></span><span>HelloDeepseekHarness</span><span class="dsh-lg-unofficial">非官方</span></div>
    <div class="dsh-lg-controls">
      <button class="dsh-lg-btn dsh-lg-min" title="最小化">${ICONS.minimize}</button>
      <button class="dsh-lg-btn dsh-lg-max" title="${isMaximized ? '还原' : '最大化'}">${isMaximized ? ICONS.restore : ICONS.maximize}</button>
      <button class="dsh-lg-btn dsh-lg-close" title="关闭">${ICONS.close}</button>
    </div>
  `;
  bar.querySelector('.dsh-lg-min').addEventListener('click', () => ipcRenderer.send('win:minimize'));
  bar.querySelector('.dsh-lg-max').addEventListener('click', () => ipcRenderer.send('win:maximize-toggle'));
  bar.querySelector('.dsh-lg-close').addEventListener('click', () => ipcRenderer.send('win:close'));
  // 双击横栏空白处切换最大化(按钮 no-drag 不受影响)
  bar.addEventListener('dblclick', (e) => {
    if (e.target === bar || e.target.closest('.dsh-lg-brand')) ipcRenderer.send('win:maximize-toggle');
  });
  return bar;
}

// ================= 主题:默认浅色(用户指定;深色模式暂不用) =================
// ================= 主题同步:跟随 WebUI 的深浅模式 =================
// WebUI 深色模式的 DOM 标记是 body[data-ds-dark-theme](浅色时属性不存在,
// 由 @deepseek-ai/dsh-client-ui-theme 设置)。外部玻璃壳据此同步切换
// html[data-lg-theme] → light / dark,外框/标题栏/胶囊跟随变色。
function syncThemeFromWebUI() {
  const dark = document.body.hasAttribute('data-ds-dark-theme');
  const root = document.documentElement;
  const want = dark ? 'dark' : 'light';
  if (root.getAttribute('data-lg-theme') !== want) root.setAttribute('data-lg-theme', want);
}

// ================= 注入(防重复,SPA 路由变化时保持) =================
function inject() {
  if (!document.body) return;
  document.documentElement.classList.add('dsh-lg-host');
  if (!document.getElementById(TITLEBAR_ID + '-style')) {
    const style = document.createElement('style');
    style.id = TITLEBAR_ID + '-style';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }
  if (!document.getElementById(TITLEBAR_ID)) {
    document.body.insertBefore(buildTitlebar(), document.body.firstChild);
  }
  // 外层装饰边框(层级最低,z-index:0,不拦截点击)
  if (!document.getElementById('dsh-lg-frame')) {
    const frame = document.createElement('div');
    frame.id = 'dsh-lg-frame';
    document.body.insertBefore(frame, document.body.firstChild);
  }
  // 初始同步一次主题(此时 body 可能已有 data-ds-dark-theme)
  syncThemeFromWebUI();
  // 监听 body 属性变化(WebUI 切换深浅模式)与结构变化(SPA 重建标题栏)
  const mo = new MutationObserver(() => {
    syncThemeFromWebUI();
    if (!document.getElementById(TITLEBAR_ID)) {
      document.body.insertBefore(buildTitlebar(), document.body.firstChild);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ds-dark-theme'] });
  // 兜底:SPA 可能替换整个 body 节点,轮询确保同步(低频,开销可忽略)
  setInterval(syncThemeFromWebUI, 1500);
}

function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
  // 窗口状态(最大化/全屏)→ 切换图标与最外层圆角
  ipcRenderer.on('window-state', (_e, s) => {
    isMaximized = !!s.maximized;
    // 最大化时窗口铺满屏幕,去掉最外层四角圆角(悬浮窗口形态才有圆角)
    document.documentElement.classList.toggle('dsh-lg-maximized', isMaximized);
    document.documentElement.classList.toggle('dsh-lg-fullscreen', !!s.fullscreen);
    const btn = document.getElementById(TITLEBAR_ID)?.querySelector('.dsh-lg-max');
    if (btn) {
      btn.innerHTML = isMaximized ? ICONS.restore : ICONS.maximize;
      btn.title = isMaximized ? '还原' : '最大化';
    }
  });
}

boot();
