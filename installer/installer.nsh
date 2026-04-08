; ============================================================================
; cmpDesk NSIS Installer Customization
; ============================================================================
; Compatible with electron-builder.
; ============================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ============================================================================
; CUSTOM INSTALL MACRO
; ============================================================================

!macro customInstall
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\cmpDesk.lnk" "$INSTDIR\cmpDesk.exe" "" "$INSTDIR\cmpDesk.exe" 0
  DetailPrint "Raccourci Bureau créé: $DESKTOP\cmpDesk.lnk"
  
  ; Write installation info to registry
  WriteRegStr HKCU "Software\cmpDesk" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\cmpDesk" "Version" "${VERSION}"
!macroend

; ============================================================================
; CUSTOM UNINSTALL MACRO
; ============================================================================

!macro customUnInstall
  ; Remove desktop shortcut
  Delete "$DESKTOP\cmpDesk.lnk"
  
  ; Clean up registry
  DeleteRegKey HKCU "Software\cmpDesk"
!macroend

; ============================================================================
; CUSTOM INIT - Check for running instance
; ============================================================================

!macro customInit
  ; Check if app is running
  FindWindow $0 "" "cmpDesk"
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "cmpDesk est en cours d'exécution.$\n$\nVeuillez fermer l'application avant de continuer."
    Abort
  ${EndIf}
!macroend
