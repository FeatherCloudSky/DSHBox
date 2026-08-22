// afterPack hook: 给打包后的 exe 注入 DeepSeek 鲸鱼图标
// 绕过 winCodeSign 依赖(其 .7z 在无管理员权限的 Windows 上解压 symlink 失败)
// 用 rcedit 直接修改 win-unpacked 里的 exe 资源
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  if (electronPlatformName !== 'win32') return;

  // 定位 exe(executableName 或 productName)
  const execName = (packager.executableName || 'HelloDeepseekHarness') + '.exe';
  let exePath = path.join(appOutDir, execName);
  if (!fs.existsSync(exePath)) {
    // 兜底:找目录下的 exe
    const found = fs.readdirSync(appOutDir).find(f => f.endsWith('.exe') && f !== 'unins000.exe');
    if (!found) { console.log('[afterPack] no exe found'); return; }
    exePath = path.join(appOutDir, found);
  }

  const iconPath = path.join(__dirname, '..', 'app', 'assets', 'deepseek.ico');
  if (!fs.existsSync(iconPath)) { console.log('[afterPack] icon missing: ' + iconPath); return; }

  // 定位 rcedit(从 winCodeSign 缓存或 7zip 工具链)
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign'),
  ];
  let rcedit = null;
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return null;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const p = path.join(dir, d.name, 'rcedit-x64.exe');
      if (fs.existsSync(p)) return p;
    }
    return null;
  };
  for (const c of candidates) { rcedit = scan(c); if (rcedit) break; }
  if (!rcedit) { console.log('[afterPack] rcedit not found, icon injection skipped'); return; }

  console.log('[afterPack] injecting icon ' + iconPath + ' -> ' + exePath + ' using ' + rcedit);
  try {
    execFileSync(rcedit, [exePath, '--set-icon', iconPath], { stdio: 'pipe' });
    console.log('[afterPack] icon injected OK');
  } catch (e) {
    console.log('[afterPack] icon injection failed: ' + (e.stderr ? e.stderr.toString() : e.message));
  }
};
