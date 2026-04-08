; ============================================================================
; cmpDesk NSIS Installer Customization
; ============================================================================
; Adds a custom page with checkbox for desktop shortcut selection.
; Compatible with electron-builder.
; ============================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; Variables for checkbox states
Var CreateDesktopIcon
Var DesktopIconCheckbox

; ============================================================================
; CUSTOM INSTALL OPTIONS PAGE
; ============================================================================

; Page creation function
Function customPage_InstallOptions
  !insertmacro MUI_HEADER_TEXT "Options d'installation" "Choisissez les options d'installation supplémentaires."
  
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  
  ; Create checkbox for desktop shortcut
  ${NSD_CreateCheckbox} 0 20u 100% 12u "Créer un raccourci sur le Bureau"
  Pop $DesktopIconCheckbox
  ${NSD_Check} $DesktopIconCheckbox ; Checked by default
  
  ; Add informational text
  ${NSD_CreateLabel} 0 50u 100% 24u "Le raccourci sur le Bureau vous permet d'accéder rapidement à cmpDesk. Vous pouvez le supprimer plus tard si vous le souhaitez."
  Pop $0
  
  nsDialogs::Show
FunctionEnd

; Page leave function - save user's choice
Function customPage_InstallOptions_Leave
  ${NSD_GetState} $DesktopIconCheckbox $CreateDesktopIcon
FunctionEnd

; ============================================================================
; CUSTOM INSTALL MACRO
; ============================================================================

!macro customInstall
  ; Create desktop shortcut only if user checked the box
  ${If} $CreateDesktopIcon == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\cmpDesk.lnk" "$INSTDIR\cmpDesk.exe" "" "$INSTDIR\cmpDesk.exe" 0
    DetailPrint "Raccourci Bureau créé: $DESKTOP\cmpDesk.lnk"
  ${Else}
    DetailPrint "Raccourci Bureau non créé (option désélectionnée)"
  ${EndIf}
  
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

; ============================================================================
; REGISTER CUSTOM PAGE
; ============================================================================

!macro customPageAfterChangeDir
  Page custom customPage_InstallOptions customPage_InstallOptions_Leave
!macroend
