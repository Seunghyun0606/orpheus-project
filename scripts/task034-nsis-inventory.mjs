// Metadata from the exact CLI release source, confirmed present in its installed
// native binary. No latest-version fallback or arbitrary tool URL.
export const CLI_VERSION = '2.11.5';
export const CLI_BINARY = 'node_modules/@tauri-apps/cli-win32-x64-msvc/cli.win32-x64-msvc.node';
export const NSIS_SOURCE =
  'https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.11.5/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs';
export const NSIS_DOWNLOADS = [
  {
    name: 'nsis-3.11.zip',
    url: 'https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip',
    sha1: 'EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D',
  },
  {
    name: 'nsis_tauri_utils.dll',
    url: 'https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll',
    sha1: '75197FEE3C6A814FE035788D1C34EAD39349B860',
  },
];
export const REQUIRED_NSIS_FILES = [
  'makensis.exe',
  'Bin/makensis.exe',
  'Stubs/lzma-x86-unicode',
  'Stubs/lzma_solid-x86-unicode',
  'Plugins/x86-unicode/additional/nsis_tauri_utils.dll',
  'Include/MUI2.nsh',
  'Include/FileFunc.nsh',
  'Include/x64.nsh',
  'Include/nsDialogs.nsh',
  'Include/WinMessages.nsh',
  'Include/Win/COM.nsh',
  'Include/Win/Propkey.nsh',
  'Include/Win/RestartManager.nsh',
];
export const TOOL_MANIFEST = '.orpheus-task034-tools.json';
// Pin the independently recorded, verified acquisition inventory; a cache must
// not authorize its own changed executable hashes by rewriting its manifest.
export const PINNED_TOOL_MANIFEST_SHA256 =
  '861653fce0efea66520bfdd6e0aa629ae7233b41c1410db1b475a1236278e030';
