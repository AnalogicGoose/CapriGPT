'use strict';

// A no-console parent can make Ollama's GPU discovery children allocate visible
// consoles. Give this fixed, trusted server a hidden console to inherit instead.
// This does not hide arbitrary user programs or alter Windows terminal settings.
const path = require('node:path');

function environmentBlock(input) {
  const env = new Map();
  for (const [key, value] of Object.entries(input)) {
    if (!key || /[=\0]/.test(key) || value === undefined || /\0/.test(String(value))) continue;
    env.set(key.toUpperCase(), `${key}=${value}`);
  }
  return Buffer.from([...env.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value).join('\0') + '\0\0', 'utf16le');
}

function startHiddenOllama(file, host) {
  if (process.platform !== 'win32' || !path.isAbsolute(file) || path.basename(file).toLowerCase() !== 'ollama.exe') throw Error('Expected the installed Windows Ollama executable.');
  const url = new URL(host);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Expected a loopback Ollama host.');
  const ffi = require('koffi');
  const kernel = ffi.load(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'kernel32.dll'));
  const bind = (name, result, args) => kernel.func('__stdcall', name, result, args);
  const createFile = bind('CreateFileW', 'intptr_t', ['str16', 'uint32', 'uint32', 'void *', 'uint32', 'uint32', 'intptr_t']);
  const createProcess = bind('CreateProcessW', 'int32', ['str16', 'void *', 'void *', 'void *', 'int32', 'uint32', 'void *', 'str16', 'void *', 'void *']);
  const close = bind('CloseHandle', 'int32', ['intptr_t']);
  const lastError = bind('GetLastError', 'uint32', []);
  const wide = ffi.sizeof('void *') === 8;
  const security = Buffer.alloc(wide ? 24 : 12);
  security.writeUInt32LE(security.length, 0);
  security.writeUInt32LE(1, wide ? 16 : 8); // inheritable NUL handle
  const nul = createFile('NUL', 0xc0000000, 3, security, 3, 0x80, 0);
  if (!nul || nul === -1 || nul === -1n) throw Error('Could not open the local background output handle.');
  const startup = Buffer.alloc(wide ? 104 : 68), info = Buffer.alloc(wide ? 24 : 16);
  startup.writeUInt32LE(startup.length, 0);
  startup.writeUInt32LE(0x101, wide ? 60 : 44); // USESHOWWINDOW + USESTDHANDLES
  startup.writeUInt16LE(0, wide ? 64 : 48); // SW_HIDE before console creation
  for (const offset of wide ? [80, 88, 96] : [56, 60, 64]) {
    if (wide) startup.writeBigUInt64LE(BigInt(nul), offset);
    else startup.writeUInt32LE(Number(nul), offset);
  }
  const command = Buffer.from(`"${file}" serve\0`, 'utf16le');
  const environment = environmentBlock({ ...process.env, OLLAMA_HOST: url.origin });
  try {
    // CREATE_NEW_CONSOLE | CREATE_UNICODE_ENVIRONMENT. Not DETACHED_PROCESS or
    // CREATE_NO_WINDOW: GPU discovery children must have a console to inherit.
    if (!createProcess(file, command, null, null, 1, 0x410, environment, path.dirname(file), startup, info)) {
      throw Error(`Could not start the hidden local Ollama server (Windows ${lastError()}).`);
    }
    const processHandle = wide ? info.readBigInt64LE(0) : info.readInt32LE(0);
    const threadHandle = wide ? info.readBigInt64LE(8) : info.readInt32LE(4);
    close(threadHandle); close(processHandle);
    return { pid: info.readUInt32LE(wide ? 16 : 8), host: url.origin };
  } finally { close(nul); }
}

module.exports = { startHiddenOllama, environmentBlock };
