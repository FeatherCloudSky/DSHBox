# DeepSeek Harness Desktop

> 非官方 Windows 一键安装包：将 DeepSeek Harness（dsh）WebUI 封装为独立桌面应用，内置完整运行时，无需任何前置安装，双击即用。

本仓库提供 DeepSeek Harness 桌面版（非官方社区构建）的安装程序与使用文档。Electron 壳源码、构建配置与内置运行时位于源码工程（`package-app/`），随本仓库或独立源码仓库发布。

## 特性

- **一键安装**：NSIS 安装向导，自动创建桌面快捷方式与开始菜单项，图标为 DeepSeek 鲸鱼 logo（多尺寸 16~256px 内置）
- **无边框玻璃窗口**：顶部品牌胶囊（带「非官方」标识）+ 右上角悬浮胶囊按钮组（最小化 / 最大化 / 关闭），明暗自适应
- **零依赖**：内置 Node.js 与 dsh 运行时，无需预装任何环境
- **数据保留**：卸载不删除用户数据（会话、配置、插件）
- **关窗即停**：关闭窗口自动停止后台服务，无残留进程

## 下载

前往 [Releases](https://github.com/FeatherCloudSky/DSHBox/releases) 下载最新版 `DeepSeek-Harness-Setup-<version>.exe`。

| 项 | 要求 |
|---|---|
| 系统 | Windows 10 / 11（x64） |
| 磁盘 | 安装后约 800 MB |
| 网络 | 首次使用需联网（AI 服务调用） |
| 依赖 | 无（Node.js、Python 等均内置） |

## 安装

1. 双击 `DeepSeek-Harness-Setup-<version>.exe`，按向导操作；
2. 可自定义安装目录（默认 `%LOCALAPPDATA%\Programs\DeepSeek Harness`）；
3. 向导自动创建桌面快捷方式与开始菜单项；
4. 安装完成后自动启动应用。

> 提示：安装前请先关闭正在运行的 DeepSeek Harness 窗口，避免程序文件被占用导致安装/升级失败。

> 提示：本安装包为社区构建，**未做代码签名**（无商业签名证书），Windows SmartScreen 可能提示"已保护你的电脑"，点击"更多信息 → 仍要运行"即可；个别杀毒软件可能误报，属未签名程序的常见现象。

## 使用

- 应用自动拉起内置 dsh 服务，监听 `http://127.0.0.1:8898`，就绪后显示主界面（冷启动约 10~30 秒）；
- 若检测到旧版数据目录（`%USERPROFILE%\.dsh`），会自动迁移到新位置，用户数据、会话、配置不丢失；
- 关闭窗口 = 停止服务（无后台残留）。

| 项 | 位置 |
|---|---|
| 用户数据（会话/配置/插件） | `%APPDATA%\DeepSeek Harness\dsh-home` |
| 界面缓存（Chromium） | `%APPDATA%\DeepSeek Harness\user-data` |
| 服务端口 | `127.0.0.1:8898`（固定） |

备份：直接复制 `dsh-home` 目录即可完整备份。

## 卸载

通过 Windows"设置 → 应用"或"控制面板 → 卸载程序"卸载；卸载后用户数据保留（`deleteAppDataOnUninstall: false`），如需彻底清理请手动删除上述数据目录。

## 从源码构建

源码工程位于 `package-app/`（Electron 壳 + builder 配置 + runtime-staging 内置运行时）。

```bat
cd builder
build.bat
```

构建说明：

- 环境：Node.js + npm，`builder/` 下安装 `electron-builder` 等依赖；
- `builder/electron-builder.config.js` 中 `electronDist` 通过环境变量 `ELECTRON_DIST` 指定本地 Electron 目录（避免重新下载），不设置时 electron-builder 自动联网下载，请勿在配置里硬编码本机路径；
- 网络受限时可通过环境变量 `ELECTRON_BUILDER_BINARIES_MIRROR` 指定 winCodeSign 等二进制下载镜像（如 `https://npmmirror.com/mirrors/electron-builder-binaries/`）；
- 图标注入依赖 electron-builder 的 rcedit（winCodeSign 包）；非管理员账号下若遇 7za 符号链接解压失败（`SeCreateSymbolicLinkPrivilege`），需要以管理员身份运行或调整 7zip-bin 的调用参数（`-snld` → `-snl-`）。

## 目录结构

```
package-app/
├── app/                      Electron 壳源码（main.js / preload.js / assets）
├── builder/                  electron-builder 配置与构建脚本
│   ├── electron-builder.config.js
│   ├── afterPack-icon.js     构建后注入鲸鱼图标
│   ├── build.bat             一键构建脚本
│   ├── nsis/custom.nsh       自定义 NSIS 脚本（VC++ 运行库检查）
│   └── dist/                 构建产物（安装包 + win-unpacked）
└── runtime-staging/          内置运行时（node + dsh），打包为 resources/runtime
```

## 作者

- [FeatherCloudSky](https://github.com/FeatherCloudSky)

## 免责声明

- 本项目为**非官方社区构建**，与 DeepSeek 官方无隶属、赞助或背书关系；应用界面内置「非官方」标识；
- "DeepSeek" 名称、鲸鱼 logo 及相关标识的版权与商标权归**杭州深度求索人工智能基础技术研究有限公司**所有，本项目仅作标识性引用，不构成任何授权或关联；
- 本项目内置 `@deepseek-ai/dsh`（MIT License，Copyright (c) 2026 DeepSeek），随包保留其 LICENSE 文件，详见 `resources/runtime/dsh/LICENSE`；
- 本项目按"原样"提供，不附带任何明示或默示的担保；使用本项目产生的任何后果由使用者自行承担。

## 许可证

本项目（Electron 壳、构建配置等原创部分）采用 [MIT License](LICENSE)。内置第三方组件遵循各自许可证（Electron、dsh 等均为 MIT 系许可）。
