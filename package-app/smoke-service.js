// 冒烟测试:用 staged 运行时启动服务并验证 8898 可访问
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const stage = path.join(__dirname, 'runtime-staging');
const home = path.join(__dirname, 'dev-data', 'smoke-home');
fs.mkdirSync(home, { recursive: true });
const nodeExe = path.join(stage, 'node', 'node.exe');
const dshBin = path.join(stage, 'dsh', 'lib', 'bin.js');
console.log('spawning: ' + nodeExe + ' ' + dshBin + ' web --port 8898');
const env = { ...process.env, DSH_HOME: home, DSH_WEB_URL: 'http://127.0.0.1:8898' };
const proc = spawn(nodeExe, [dshBin, 'web', '--port', '8898'], { env, stdio: 'inherit', windowsHide: true });
const probe = () => new Promise(res => {
  http.get('http://127.0.0.1:8898/', r => { res(true); r.resume(); }).on('error', () => res(false));
});
(async () => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await probe()) { console.log('SERVICE UP'); break; }
    await new Promise(r => setTimeout(r, 800));
  }
  if (!(await probe())) console.log('SERVICE TIMEOUT');
  // 杀服务验证看门狗
  setTimeout(() => { proc.kill(); console.log('killed, waiting...'); setTimeout(() => process.exit(0), 1500); }, 1500);
})();
