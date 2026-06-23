; Inno Setup script for ScrivenLight.
; Build with:  iscc installer_windows.iss   (after build_windows.bat has run)
; Produces:    Output\ScrivenLight-Setup.exe
;
; Inno Setup is free: https://jrsoftware.org/isdl.php

#define AppName "ScrivenLight"
#define AppVersion "1.0.0"
#define AppPublisher "ScrivenLight"
#define AppExeName "ScrivenLight.exe"

[Setup]
AppId={{8E5C2A10-2C7F-4E1A-9B3D-SCRIVENLIGHT01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputBaseFilename={#AppName}-Setup
OutputDir=Output
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; install per-user so no admin prompt is required
PrivilegesRequiredOverridesAllowed=dialog
SetupIconFile=scrivenlight.ico
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "associate"; Description: "Associate .slt and .fountain files with {#AppName}"; GroupDescription: "File associations:"

[Files]
; the entire PyInstaller onedir output
Source: "dist\{#AppName}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
; .slt association
Root: HKA; Subkey: "Software\Classes\.slt"; ValueType: string; ValueName: ""; ValueData: "ScrivenLight.Project"; Flags: uninsdeletevalue; Tasks: associate
Root: HKA; Subkey: "Software\Classes\ScrivenLight.Project"; ValueType: string; ValueName: ""; ValueData: "ScrivenLight Project"; Flags: uninsdeletekey; Tasks: associate
Root: HKA; Subkey: "Software\Classes\ScrivenLight.Project\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExeName},0"; Tasks: associate
Root: HKA; Subkey: "Software\Classes\ScrivenLight.Project\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""; Tasks: associate
; .fountain association
Root: HKA; Subkey: "Software\Classes\.fountain"; ValueType: string; ValueName: ""; ValueData: "ScrivenLight.Fountain"; Flags: uninsdeletevalue; Tasks: associate
Root: HKA; Subkey: "Software\Classes\ScrivenLight.Fountain"; ValueType: string; ValueName: ""; ValueData: "Fountain Screenplay"; Flags: uninsdeletekey; Tasks: associate
Root: HKA; Subkey: "Software\Classes\ScrivenLight.Fountain\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""; Tasks: associate

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent
