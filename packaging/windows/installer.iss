; ResearchLoom Modern Windows Inno Setup Installer Script
; Generates ResearchLoom-Setup.exe with Desktop & Start Menu shortcuts,
; system tray integration, clean uninstaller, and per-user installation.

#define MyAppName "ResearchLoom"
#define MyAppVersion "4.3.7"
#define MyAppPublisher "ResearchLoom Authors"
#define MyAppURL "https://github.com/sohamsans/researchloom"
#define MyAppExeName "ResearchLoom.exe"

[Setup]
AppId={{5E4A7B21-82B3-4A59-A92B-53B4A2C59D81}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
VersionInfoVersion=4.3.7.0
VersionInfoCompany=ResearchLoom Authors
VersionInfoDescription=ResearchLoom Setup Installer
VersionInfoTextVersion=4.3.7
VersionInfoCopyright=Copyright (c) 2026 ResearchLoom Authors
DefaultDirName={autopf}\{#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\..\dist_setup
OutputBaseFilename=ResearchLoom-Setup
SetupIconFile=..\..\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start ResearchLoom automatically minimized in system tray on Windows login"; GroupDescription: "Background Agent:"

[Files]
Source: "..\..\dist\ResearchLoom.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\icon.png"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon; IconFilename: "{app}\icon.ico"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
