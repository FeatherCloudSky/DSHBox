// HelloDeepseekHarness 独立 App — 主进程
// 职责:内置 node 拉起 dsh web 服务(端口 8898)、用户数据目录管理、
//       无边框玻璃窗口、窗口控制 IPC、单实例防重复、关窗即停服。
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const APP_NAME = 'HelloDeepseekHarness';
app.setName(APP_NAME);
app.setAppUserModelId('HelloDeepseekHarness');

// 端口可配置(测试用;正式固定 8898)
const PORT = Number(process.env.DSH_PORT || 8898);
const WEB_URL = `http://127.0.0.1:${PORT}`;

// ================= 路径解析 =================
// 开发模式:resources 在项目下 runtime-staging/;打包后:process.resourcesPath
function runtimeDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'runtime');
  return path.join(__dirname, '..', '..', 'runtime-staging');
}
const NODE_EXE = () => path.join(runtimeDir(), 'node', 'node.exe');
const DSH_BIN = () => path.join(runtimeDir(), 'dsh', 'lib', 'bin.js');

// 用户数据目录(会话/设置/插件),独立于安装目录 → 覆盖安装/卸载都不丢
// 开发模式:项目下 dev-data/ 便于测试;打包后:%APPDATA%\HelloDeepseekHarness\dsh-home
const DSH_HOME = () => {
  if (!app.isPackaged) return path.join(__dirname, '..', '..', 'dev-data', 'dsh-home');
  return path.join(app.getPath('appData'), 'HelloDeepseekHarness', 'dsh-home');
};

// userData 重定向(Chromium 缓存/会话等)
const udArg = process.argv.find(a => a.startsWith('--userdata-dir='));
const USER_DATA = udArg ? udArg.slice(15) : (app.isPackaged
  ? path.join(app.getPath('appData'), 'HelloDeepseekHarness', 'user-data')
  : path.join(__dirname, '..', '..', 'dev-data', 'user-data'));
try { app.setPath('userData', USER_DATA); } catch (_) {}

// ================= 服务生命周期 =================
let serviceProc = null;
let serviceStarting = false;

function probeService() {
  try {
    const r = spawnSync('powershell', ['-NoProfile', '-Command',
      `try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:${PORT}/' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }`],
      { stdio: 'ignore', timeout: 8000 });
    return r.status === 0;
  } catch { return false; }
}

function startService() {
  return new Promise((resolve) => {
    if (probeService()) { console.log('[svc] already up'); resolve(true); return; }
    if (serviceStarting) { resolve(false); return; }
    serviceStarting = true;

    const nodeExe = NODE_EXE();
    const dshBin = DSH_BIN();
    if (!fs.existsSync(nodeExe) || !fs.existsSync(dshBin)) {
      console.error('[svc] runtime missing: node=' + nodeExe + ' dsh=' + dshBin);
      serviceStarting = false;
      resolve(false);
      return;
    }

    // 确保 DSH_HOME 存在
    const home = DSH_HOME();
    try { fs.mkdirSync(home, { recursive: true }); } catch (_) {}

    console.log('[svc] starting: ' + nodeExe + ' ' + dshBin + ' web --port ' + PORT);
    const env = { ...process.env, DSH_HOME: home, DSH_WEB_URL: WEB_URL };
    // Windows 下隐藏窗口跑服务(无任何命令行窗口闪现)
    const opts = { env, stdio: 'ignore', windowsHide: true, detached: false };
    try {
      serviceProc = spawn(nodeExe, [dshBin, 'web', '--port', String(PORT)], opts);
    } catch (e) {
      console.error('[svc] spawn failed: ' + e.message);
      serviceStarting = false;
      resolve(false);
      return;
    }
    serviceProc.on('error', (e) => { console.error('[svc] error: ' + e.message); });
    serviceProc.on('exit', (code) => {
      console.log('[svc] exited code=' + code);
      serviceProc = null;
    });

    // 等待服务就绪(最长 30s,冷启动首次较慢)
    const deadline = Date.now() + 30000;
    const poll = () => {
      if (probeService()) { serviceStarting = false; console.log('[svc] ready'); resolve(true); return; }
      if (Date.now() > deadline) { serviceStarting = false; console.error('[svc] timeout'); resolve(false); return; }
      setTimeout(poll, 500);
    };
    setTimeout(poll, 800);
  });
}

function stopService() {
  if (serviceProc && !serviceProc.killed) {
    try { serviceProc.kill(); } catch (_) {}
    // Windows 下确保子进程树也被清理(worker 等)
    try {
      spawnSync('taskkill', ['/pid', String(serviceProc.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch (_) {}
    serviceProc = null;
  }
}

// ================= 首次启动:迁移现有用户数据 =================
const MIGRATED_FLAG = 'migrated-from';
// 旧版启动器的数据位置:按当前用户主目录动态解析,不硬编码任何机器路径
const LEGACY_HOME = path.join(os.homedir(), '.dsh');

function migrateLegacyData() {
  const home = DSH_HOME();
  try { fs.mkdirSync(home, { recursive: true }); } catch (_) {}
  const flagPath = path.join(home, MIGRATED_FLAG);
  if (fs.existsSync(flagPath)) return; // 已迁移过

  if (!fs.existsSync(LEGACY_HOME)) {
    try { fs.writeFileSync(flagPath, 'none'); } catch (_) {}
    return;
  }

  console.log('[migrate] copying legacy data from ' + LEGACY_HOME + ' -> ' + home);
  try {
    const cp = spawnSync('robocopy', [LEGACY_HOME, home, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS'], { stdio: 'ignore', timeout: 120000 });
    console.log('[migrate] robocopy exit=' + cp.status);
    // robocopy 0-7 都是成功(1=复制了文件);>=8 才是失败
    if (cp.status !== void 0 && cp.status < 8) {
      fs.writeFileSync(flagPath, LEGACY_HOME);
      console.log('[migrate] done');
    }
  } catch (e) { console.error('[migrate] failed: ' + e.message); }
}

// ================= 单实例锁 =================
const isDevInstance = process.argv.includes('--dev');
const gotLock = isDevInstance ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const shotArg = process.argv.find(a => a.startsWith('--screenshot='));
  const SHOT_PATH = shotArg ? shotArg.slice(13) : null;
  let mainWindow = null;

  function createWindow() {
    const { workArea } = screen.getPrimaryDisplay();
    let w = 1600, h = 900;
    if (workArea.width < w + 80) w = workArea.width - 80;
    if (workArea.height < h + 80) h = workArea.height - 80;
    w = Math.max(w, 640); h = Math.max(h, 480);
    const x = Math.round((workArea.width - w) / 2 + workArea.x);
    const y = Math.round((workArea.height - h) / 2 + workArea.y);

    mainWindow = new BrowserWindow({
      width: w, height: h, x, y,
      frame: false,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      icon: path.join(__dirname, 'assets', 'deepseek.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.setAutoHideMenuBar(true);

    // F11 切换真全屏
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') {
        _e.preventDefault();
        if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
        else mainWindow.setFullScreen(true);
      }
    });

    // 冷启动失败自动重载一次
    let failCount = 0;
    mainWindow.webContents.on('did-fail-load', (_e, code) => {
      if (code === -3 || failCount >= 3) return;
      failCount++;
      setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload(); }, 1200);
    });

    // 窗口状态同步(最大化/全屏)
    const sendState = (fullscreenOverride) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window-state', {
          maximized: mainWindow.isMaximized(),
          fullscreen: fullscreenOverride !== void 0 ? fullscreenOverride : mainWindow.isFullScreen()
        });
      }
    };
    mainWindow.on('maximize', () => sendState());
    mainWindow.on('unmaximize', () => sendState());
    mainWindow.on('enter-full-screen', () => sendState(true));
    mainWindow.on('leave-full-screen', () => sendState(false));
    mainWindow.once('ready-to-show', () => mainWindow.show());

    mainWindow.webContents.on('did-finish-load', () => {
      sendState();
      if (SHOT_PATH) {
        setTimeout(async () => {
          try {
            const img = await mainWindow.webContents.capturePage();
            fs.writeFileSync(SHOT_PATH, img.toPNG());
            console.log('[shot] saved ' + SHOT_PATH);
          } catch (e) { console.log('[shot] failed: ' + e.message); }
          app.quit();
        }, 3000);
      }
    });

    mainWindow.loadURL(WEB_URL);
    return mainWindow;
  }

  // ---- 窗口控制 IPC ----
  ipcMain.on('win:minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('win:maximize-toggle', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('win:close', () => { if (mainWindow) mainWindow.close(); });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // 1. 迁移旧数据(首次启动)
    migrateLegacyData();
    // 2. 拉起服务
    const ok = await startService();
    if (!ok) {
      console.error('[app] service failed to start');
      // 仍然开窗口,让用户看到错误页而非白屏
    }
    // 3. 开窗口
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  // 关窗即停服(服务与界面同生共死)
  app.on('window-all-closed', () => {
    stopService();
    app.quit();
  });

  app.on('before-quit', () => { stopService(); });
}
