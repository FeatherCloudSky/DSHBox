# HelloDeepseekHarness 源码工程

Electron 壳 + electron-builder 打包配置。内置运行时（Node.js + dsh）体积较大且为第三方二进制，**不入库**，按下方说明自行准备。

## 目录结构

```
package-app/
├── app/                      Electron 壳源码（main.js / preload.js / assets）
├── builder/                  electron-builder 配置与构建脚本
│   ├── electron-builder.config.js
│   ├── afterPack-icon.js     构建后注入鲸鱼图标（rcedit）
│   ├── build.bat             一键构建脚本
│   └── nsis/custom.nsh       自定义 NSIS 脚本（OS / VC++ 运行库检查）
├── runtime-staging/          内置运行时（不入库，见下文准备方法），打包为 resources/runtime
└── smoke-service.js          冒烟测试：验证 staged 运行时可启动 8898 服务
```

## 准备内置运行时（runtime-staging）

```bat
mkdir runtime-staging\node
mkdir runtime-staging\dsh

rem 1) Node.js v22 win-x64：将 node.exe 放入 runtime-staging\node\
rem    （从 https://nodejs.org 的 zip 发行版中提取即可）

rem 2) dsh CLI：
cd runtime-staging\dsh
npm install @deepseek-ai/dsh@0.1.0-rc.7
```

完成后目录应包含 `runtime-staging\node\node.exe` 与 `runtime-staging\dsh\lib\bin.js`。
可用冒烟脚本验证：`node smoke-service.js`（预期输出 `SERVICE UP`）。

## 构建

环境要求：Node.js 18+、npm。

```bat
cd builder
npm install
build.bat
```

说明：

- 构建产物输出到 `builder/dist/`（安装包 + win-unpacked）；
- `electron-builder.config.js` 中 `electronDist` 通过环境变量 `ELECTRON_DIST` 指定本地 Electron 目录（避免重新下载），不设置时自动联网下载；
- 网络受限时可通过环境变量 `ELECTRON_BUILDER_BINARIES_MIRROR` 指定 winCodeSign 等二进制下载镜像（如 `https://npmmirror.com/mirrors/electron-builder-binaries/`）、`ELECTRON_MIRROR` 指定 Electron 下载镜像；
- 本项目**不做代码签名**（无证书）；如遇 SmartScreen 提示属正常现象。

## 版本记录

- **1.0.1**：electron-builder 升级至 26.15.3，修复 Windows 11 24H2+ 全新安装时 NSIS 安装器在 System.dll 崩溃的问题（上游 multiUser.nsh 越界读，已在 26.9.0 修复）；custom.nsh 增加 64 位注册表视图修正与静默模式适配。
- **1.0.0**：首发。
