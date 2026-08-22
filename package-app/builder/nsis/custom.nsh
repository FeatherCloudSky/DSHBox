; HelloDeepseekHarness NSIS custom script
; - OS version check (Win10/11)
; - VC++ runtime check (prompt user if missing)
; included by electron-builder via nsis.include

!include "LogicLib.nsh"
!include "WinVer.nsh"

; ===== on install start: OS version + VC++ check =====
!macro customInit
  ; 1. OS version: require Win10 (NT 10.0) or later
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "HelloDeepseekHarness needs Windows 10 or Windows 11.`r`nThis system is too old. Setup cancelled."
    Abort
  ${EndIf}

  ; 2. VC++ runtime check (2015-2022 x64, required by Electron)
  ;    registry: HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64
  ;    NOTE: setup.exe 是 32 位进程,必须切到 64 位注册表视图,
  ;          否则会被重定向到 WOW6432Node 导致误报缺失
  DetailPrint "Checking Microsoft VC++ Runtime (2015-2022 x64)..."
  SetRegView 64
  ClearErrors
  ReadRegDWord $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Major"
  IfErrors vc_missing
  ReadRegDWord $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Minor"
  IfErrors vc_missing
  ${If} $0 < 14
  ${OrIf} $0 == 14
  ${AndIf} $1 < 38
    Goto vc_missing
  ${EndIf}
  Goto vc_done

  vc_missing:
    ${IfNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION "Microsoft VC++ Runtime (2015-2022 x64) seems missing.`r`nHelloDeepseekHarness needs it to run.`r`n`r`nOpen the official Microsoft download page now?" IDYES open_vc IDNO vc_done
      open_vc:
        ExecShell "open" "https://aka.ms/vs/17/release/vc_redist.x64.exe"
    ${Else}
      DetailPrint "WARNING: VC++ runtime (2015-2022 x64) not detected; the app may fail to start."
    ${EndIf}
  vc_done:
    SetRegView lastused
    DetailPrint "VC++ runtime check done."
!macroend

; ===== after uninstall: notify user data is kept =====
!macro customUnInstall
  MessageBox MB_OK|MB_ICONINFORMATION "HelloDeepseekHarness has been uninstalled.`r`nYour sessions and settings are kept in the user data folder."
!macroend