@echo off
cd /d "%~dp0"
rem 无代码签名证书:禁止 electron-builder 自动发现签名身份(避免误签/报错)
set CSC_IDENTITY_AUTO_DISCOVERY=false
rem 可选:指定本地 Electron 目录,避免联网下载。例:
rem   set ELECTRON_DIST=D:\path\to\node_modules\electron\dist
rem 可选:winCodeSign 等二进制下载镜像(网络受限时使用)。例:
rem   set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npx electron-builder --config electron-builder.config.js --win nsis 2>&1
