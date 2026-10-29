'use strict';

// Direct Win32 calls: no shell, terminal, script compiler, screenshot or key hook.
// Native libraries are loaded lazily so disabled features/non-Windows stay inert.
const path = require('node:path');
const { friendlyName } = require('./app-names');
let cached;
function api() {
  if (process.platform !== 'win32') throw Error('Windows context is unavailable.');
  if (cached) return cached;
  const ffi = require('koffi');
  const library = name => ffi.load(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name));
  const kernel = library('kernel32.dll'), user = library('user32.dll'), dwm = library('dwmapi.dll');
  const bind = (lib, name, result, args) => lib.func('__stdcall', name, result, args);
  const callback = ffi.proto('__stdcall', 'CapriEnumWindow', 'int32', ['uintptr_t', 'intptr_t']);
  cached = {
    ptrSize: ffi.sizeof('void *'),
    snapshot: bind(kernel, 'CreateToolhelp32Snapshot', 'intptr_t', ['uint32', 'uint32']),
    first: bind(kernel, 'Process32FirstW', 'int32', ['intptr_t', 'void *']),
    next: bind(kernel, 'Process32NextW', 'int32', ['intptr_t', 'void *']),
    close: bind(kernel, 'CloseHandle', 'int32', ['intptr_t']),
    open: bind(kernel, 'OpenProcess', 'intptr_t', ['uint32', 'int32', 'uint32']),
    terminate: bind(kernel, 'TerminateProcess', 'int32', ['intptr_t', 'uint32']),
    power: bind(kernel, 'GetSystemPowerStatus', 'int32', ['void *']),
    enumerate: bind(user, 'EnumWindows', 'int32', [ffi.pointer(callback), 'intptr_t']),
    foreground: bind(user, 'GetForegroundWindow', 'uintptr_t', []),
    pid: bind(user, 'GetWindowThreadProcessId', 'uint32', ['uintptr_t', 'void *']),
    title: bind(user, 'GetWindowTextW', 'int32', ['uintptr_t', 'void *', 'int32']),
    className: bind(user, 'GetClassNameW', 'int32', ['uintptr_t', 'void *', 'int32']),
    visible: bind(user, 'IsWindowVisible', 'int32', ['uintptr_t']),
    iconic: bind(user, 'IsIconic', 'int32', ['uintptr_t']),
    zoomed: bind(user, 'IsZoomed', 'int32', ['uintptr_t']),
    style: bind(user, 'GetWindowLongW', 'int32', ['uintptr_t', 'int32']),
    attribute: bind(dwm, 'DwmGetWindowAttribute', 'int32', ['uintptr_t', 'uint32', 'void *', 'uint32']),
    post: bind(user, 'PostMessageW', 'int32', ['uintptr_t', 'uint32', 'uintptr_t', 'intptr_t']),
  };
  return cached;
}

function processRows() {
  const a = api(), handle = a.snapshot(2, 0);
  if (handle === -1 || handle === -1n || !handle) throw Error('Process enumeration unavailable.');
  // PROCESSENTRY32W: ULONG_PTR alignment changes the size and string offset.
  const size = a.ptrSize === 8 ? 568 : 556, offset = a.ptrSize === 8 ? 44 : 36;
  const entry = Buffer.alloc(size); entry.writeUInt32LE(size, 0);
  const rows = [];
  try {
    let valid = a.first(handle, entry);
    if (!valid) throw Error('Process enumeration unavailable.');
    while (valid && rows.length < 32768) {
      rows.push({ id: entry.readUInt32LE(8), parentId: entry.readUInt32LE(a.ptrSize === 8 ? 32 : 24),
        name: entry.toString('utf16le', offset, offset + 520).split('\0')[0].replace(/\.exe$/i, '').toLowerCase() });
      valid = a.next(handle, entry);
    }
  } finally { a.close(handle); }
  return rows;
}

function windowPid(hwnd) {
  const value = Buffer.alloc(4);
  return api().pid(hwnd, value) ? value.readUInt32LE(0) : null;
}

function windows({ geometry = false, exclude = 0 } = {}) {
  const a = api(), rows = [];
  let failure;
  a.enumerate(hwnd => {
    try {
      if (Number(hwnd) === Number(exclude) || !a.visible(hwnd) || (a.style(hwnd, -20) & 0x80)) return 1;
      const cloaked = Buffer.alloc(4);
      if (a.attribute(hwnd, 14, cloaked, 4) === 0 && cloaked.readUInt32LE(0)) return 1;
      const cls = Buffer.alloc(128);
      const length = a.className(hwnd, cls, 64);
      if (['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'].includes(cls.toString('utf16le', 0, length * 2))) return 1;
      const row = { hwnd: Number(hwnd), pid: windowPid(hwnd) };
      if (geometry) {
        if (a.iconic(hwnd) || (a.style(hwnd, -20) & 0x08000000)) return 1;
        const rect = Buffer.alloc(16);
        if (a.attribute(hwnd, 9, rect, 16) !== 0) return 1;
        Object.assign(row, { id: Number(hwnd), x: rect.readInt32LE(0), y: rect.readInt32LE(4),
          w: rect.readInt32LE(8) - rect.readInt32LE(0), h: rect.readInt32LE(12) - rect.readInt32LE(4), max: Boolean(a.zoomed(hwnd)) });
        if (row.w < 200 || row.h < 120) return 1;
      }
      rows.push(row);
      return rows.length < (geometry ? 40 : 256) ? 1 : 0;
    } catch (err) { failure = err; return 0; }
  }, 0);
  if (failure) throw failure;
  return rows;
}

function desktopApps(rows = processRows()) {
  const table = new Map(rows.map(row => [row.id, row.name]));
  const apps = new Map();
  for (const window of windows()) {
    const name = table.get(window.pid);
    if (!name || window.pid === process.pid) continue;
    const row = apps.get(name) || { name, process: name, label: friendlyName(name), ids: [], handles: [] };
    if (!row.ids.includes(window.pid)) row.ids.push(window.pid);
    row.handles.push(window.hwnd);
    apps.set(name, row);
  }
  return [...apps.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function context(options) {
  const result = {}, allow = new Set(options.processAllowlist);
  let table;
  if (options.contextProcesses || options.contextForeground) {
    try { table = processRows(); } catch { result.unavailable = true; }
  }
  const allowed = name => Boolean(name) && (options.allApps === true || allow.has(name));
  if (options.contextProcesses && table) {
    result.processes = [...new Set(table.filter(row => allowed(row.name)).map(row => row.name))];
    try { result.apps = desktopApps(table).filter(row => allowed(row.name)).map(row => row.name); }
    catch { /* Process names remain available if desktop window enumeration fails. */ }
  }
  if (options.contextForeground && table) {
    try {
      const a = api(), hwnd = a.foreground();
      const name = table.find(row => row.id === windowPid(hwnd))?.name;
      if (allowed(name)) {
        result.foreground = { app: name };
        if (options.contextTitles) {
          const title = Buffer.alloc(402), length = a.title(hwnd, title, 201);
          result.foreground.title = title.toString('utf16le', 0, Math.max(0, length) * 2);
        }
      }
    } catch { result.foreground = { unavailable: true }; }
  }
  if (options.contextPower) {
    try {
      const data = Buffer.alloc(12);
      if (!api().power(data)) throw Error('Power unavailable');
      const flags = data[1], unknown = flags === 255, noBattery = Boolean(flags & 128);
      result.power = { ac: ['Offline', 'Online'][data[0]] || 'Unknown',
        battery_percent: unknown || noBattery || data[2] === 255 ? null : data[2],
        charging: unknown || noBattery ? null : Boolean(flags & 8) };
    } catch { result.power = { unavailable: true }; }
  }
  return result;
}

function geometry(exclude) {
  return { fg: Number(api().foreground()), wins: windows({ geometry: true, exclude }) };
}

// Fast geometry-only probe for fullscreen presence. No titles/process enumeration.
function foregroundBounds() {
  const a = api(), hwnd = a.foreground();
  if (!hwnd || !a.visible(hwnd) || a.iconic(hwnd)) return null;
  const cls = Buffer.alloc(128), length = a.className(hwnd, cls, 64);
  const className = cls.toString('utf16le', 0, Math.max(0, length * 2));
  if (['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'].includes(className)) return null;
  const rect = Buffer.alloc(16);
  if (a.attribute(hwnd, 9, rect, 16) !== 0) return null;
  return { id: Number(hwnd), pid: windowPid(hwnd), caption: Boolean(a.style(hwnd, -16) & 0x00c00000),
    x: rect.readInt32LE(0), y: rect.readInt32LE(4),
    width: rect.readInt32LE(8) - rect.readInt32LE(0), height: rect.readInt32LE(12) - rect.readInt32LE(4) };
}

// Explicit troubleshooting only: window class/PID, never terminal text or titles.
function consoleWindows() {
  const a = api(), result = [];
  a.enumerate(hwnd => {
    if (!a.visible(hwnd)) return 1;
    const buffer = Buffer.alloc(256), length = a.className(hwnd, buffer, 128);
    const cls = buffer.toString('utf16le', 0, Math.max(0, length) * 2);
    if (['ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS', 'VirtualConsoleClass', 'mintty'].includes(cls)) {
      result.push({ hwnd: Number(hwnd), pid: windowPid(hwnd), className: cls });
    }
    return 1;
  }, 0);
  return result;
}

function requestClose(handles) { for (const hwnd of handles) api().post(hwnd, 0x10, 0, 0); }
function forceClose(ids, expectedName) {
  const current = new Map(processRows().map(row => [row.id, row.name]));
  for (const id of ids) {
    if (current.get(id) !== expectedName || id === process.pid) continue;
    const a = api(), handle = a.open(1, 0, id);
    if (!handle) continue;
    try { a.terminate(handle, 1); } finally { a.close(handle); }
  }
}

module.exports = { context, desktopApps, processRows, geometry, foregroundBounds, consoleWindows, requestClose, forceClose };
