#!/usr/bin/env node
/**
 * analyze-dump.mjs
 *
 * Parses Crashpad/Breakpad Minidump (.dmp) files and prints a human-readable
 * summary: architecture, OS version, exception code, faulting address, and
 * the list of loaded modules.  If `minidump_stackwalk` is on PATH (install
 * via `brew install google-breakpad`) it also prints the full stack trace.
 *
 * Usage:
 *   node scripts/analyze-dump.mjs error_dump/*.dmp
 *   node scripts/analyze-dump.mjs path/to/file.dmp
 */
import { readFileSync } from 'node:fs';
import { spawnSync }    from 'node:child_process';
import path             from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/analyze-dump.mjs <file.dmp> [...]');
  process.exit(1);
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

const EXCEPTION_CODES = {
  0xC0000005: 'ACCESS_VIOLATION (segfault / bad pointer read-write)',
  0xC0000006: 'IN_PAGE_ERROR (page fault)',
  0xC0000017: 'NO_MEMORY / OOM',
  0xC000001D: 'ILLEGAL_INSTRUCTION (SIGILL)',
  0xC0000025: 'NONCONTINUABLE_EXCEPTION',
  0x80000001: 'GUARD_PAGE_VIOLATION',
  0x80000003: 'BREAKPOINT',
  0x80000004: 'SINGLE_STEP',
  0xC0000094: 'INTEGER_DIVIDE_BY_ZERO',
  0xC00000FD: 'STACK_OVERFLOW',
  0xC0000135: 'DLL_NOT_FOUND',
  0xC0000142: 'DLL_INIT_FAILED',
  0xC0000409: 'STACK_BUFFER_OVERRUN',
  0xC000C000: 'HEAP_CORRUPTION',
  // POSIX signals as written by Crashpad on macOS/Linux
  0x00000004: 'SIGILL  (illegal instruction)',
  0x00000006: 'SIGABRT (abort / V8 fatal error)',
  0x00000008: 'SIGFPE  (floating-point exception)',
  0x0000000B: 'SIGSEGV (segmentation fault)',
};

const ARCH_NAMES = {
  0:      'x86 (32-bit)',
  5:      'ARM',
  6:      'IA-64',
  9:      'x86-64 (AMD64)',
  12:     'ARM64 (Apple Silicon)',
  0xffff: 'Unknown',
};

const OS_NAMES = {
  0:      'Win32s',
  1:      'Windows 9x',
  2:      'Windows NT',
  3:      'Windows CE',
  0x8000: 'Unix',
  0x8101: 'macOS',
  0x8102: 'iOS',
  0x8201: 'Linux',
  0x8202: 'Solaris',
  0x8203: 'Android',
};

// ─── Binary helpers ───────────────────────────────────────────────────────────

function hex(n, pad = 8) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(pad, '0');
}

/** Read a MINIDUMP_STRING (UINT32 byte-len + UTF-16LE chars) at rva. */
function readMDString(buf, rva) {
  if (!rva || rva + 4 > buf.length) return '';
  const byteLen = buf.readUInt32LE(rva);
  if (!byteLen || rva + 4 + byteLen > buf.length) return '';
  return buf.subarray(rva + 4, rva + 4 + byteLen).toString('utf16le');
}

function readBigUInt64(buf, offset) {
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readUInt32LE(offset + 4);
  return (BigInt(hi) << 32n) | BigInt(lo);
}

// ─── Stream parsers ───────────────────────────────────────────────────────────

/** SystemInfoStream (type 7) — architecture, OS version. */
function parseSystemInfo(buf, rva) {
  if (rva + 28 > buf.length) return null;
  const arch     = buf.readUInt16LE(rva + 0);
  const numCpus  = buf.readUInt8(rva + 6);
  const major    = buf.readUInt32LE(rva + 8);
  const minor    = buf.readUInt32LE(rva + 12);
  const build    = buf.readUInt32LE(rva + 16);
  const platform = buf.readUInt32LE(rva + 20);
  const csdRva   = buf.readUInt32LE(rva + 24);
  return {
    arch:    ARCH_NAMES[arch] ?? `Unknown (${arch})`,
    cpuCount: numCpus,
    os:      OS_NAMES[platform] ?? `Unknown OS (${hex(platform)})`,
    version: `${major}.${minor}.${build}`,
    csd:     readMDString(buf, csdRva),
    platform,
  };
}

/** ExceptionStream (type 6) — what actually crashed. */
function parseException(buf, rva) {
  if (rva + 48 > buf.length) return null;
  // MINIDUMP_EXCEPTION_STREAM layout:
  //   +0  UINT32 ThreadId
  //   +4  UINT32 __alignment
  //   +8  MINIDUMP_EXCEPTION:
  //     +8  UINT32 ExceptionCode
  //     +12 UINT32 ExceptionFlags
  //     +16 UINT64 ExceptionRecord (linked)
  //     +24 UINT64 ExceptionAddress
  //     +32 UINT32 NumberParameters
  //     +36 UINT32 __unusedAlignment
  //     +40 UINT64[15] ExceptionInformation
  const threadId     = buf.readUInt32LE(rva + 0);
  const code         = buf.readUInt32LE(rva + 8);
  const flags        = buf.readUInt32LE(rva + 12);
  const address      = readBigUInt64(buf, rva + 24);
  const numParams    = buf.readUInt32LE(rva + 32);
  const params = [];
  for (let i = 0; i < Math.min(numParams, 15) && rva + 40 + (i + 1) * 8 <= buf.length; i++) {
    params.push(readBigUInt64(buf, rva + 40 + i * 8));
  }
  return {
    threadId,
    code,
    flags,
    address,
    params,
    codeDesc: EXCEPTION_CODES[code] ?? EXCEPTION_CODES[code >>> 0] ?? 'Unknown exception code',
  };
}

/** MiscInfoStream (type 15) — process ID. */
function parseMiscInfo(buf, rva) {
  if (rva + 12 > buf.length) return null;
  const flags = buf.readUInt32LE(rva + 4);
  const pid   = (flags & 0x1) ? buf.readUInt32LE(rva + 8) : 0;
  return { pid };
}

/**
 * ModuleListStream (type 4) — loaded modules.
 * MINIDUMP_MODULE size = 108 bytes:
 *   +0   UINT64 BaseOfImage
 *   +8   UINT32 SizeOfImage
 *   +12  UINT32 CheckSum
 *   +16  UINT32 TimeDateStamp
 *   +20  UINT32 ModuleNameRva
 *   +24  VS_FIXEDFILEINFO (52 bytes)
 *   +76  MINIDUMP_LOCATION_DESCRIPTOR CvRecord (8 bytes)
 *   +84  MINIDUMP_LOCATION_DESCRIPTOR MiscRecord (8 bytes)
 *   +92  UINT64 Reserved0
 *   +100 UINT64 Reserved1
 */
function parseModuleList(buf, rva) {
  if (rva + 4 > buf.length) return [];
  const count = buf.readUInt32LE(rva);
  const MODULE_SIZE = 108;
  const modules = [];
  for (let i = 0; i < count; i++) {
    const base = rva + 4 + i * MODULE_SIZE;
    if (base + MODULE_SIZE > buf.length) break;
    const imageBase = readBigUInt64(buf, base + 0);
    const imageSize = buf.readUInt32LE(base + 8);
    const nameRva   = buf.readUInt32LE(base + 20);
    const name      = readMDString(buf, nameRva);
    modules.push({ base: imageBase, size: imageSize, name });
  }
  return modules;
}

// ─── Core analysis ────────────────────────────────────────────────────────────

function analyzeDump(filePath) {
  const buf = readFileSync(filePath);

  if (buf.length < 32 || buf.subarray(0, 4).toString('ascii') !== 'MDMP') {
    console.error(`  ✗ Not a valid Minidump file`);
    return;
  }

  const numStreams = buf.readUInt32LE(8);
  const dirRva    = buf.readUInt32LE(12);
  const ts        = new Date(buf.readUInt32LE(20) * 1000);

  console.log(`  File:      ${path.basename(filePath)}  (${(buf.length / 1024).toFixed(0)} KB)`);
  console.log(`  Timestamp: ${ts.toISOString()}`);

  // Walk stream directory (each entry = 12 bytes: type, size, rva)
  const streams = {};
  for (let i = 0; i < numStreams; i++) {
    const entry = dirRva + i * 12;
    if (entry + 12 > buf.length) break;
    const type = buf.readUInt32LE(entry + 0);
    streams[type] = {
      size: buf.readUInt32LE(entry + 4),
      rva:  buf.readUInt32LE(entry + 8),
    };
  }

  // ── System info ────────────────────────────────────────────────────────────
  if (streams[7]) {
    const info = parseSystemInfo(buf, streams[7].rva);
    if (info) {
      const osStr = info.os === 'macOS'
        ? `macOS (Darwin ${info.version})${info.csd ? ' ' + info.csd : ''}`
        : `${info.os} ${info.version}${info.csd ? ' ' + info.csd : ''}`;
      console.log(`  Arch:      ${info.arch}  (${info.cpuCount} CPU${info.cpuCount !== 1 ? 's' : ''})`);
      console.log(`  OS:        ${osStr}`);
    }
  }

  // ── Exception ──────────────────────────────────────────────────────────────
  if (streams[6]) {
    const ex = parseException(buf, streams[6].rva);
    if (ex) {
      console.log('');
      console.log('  ┌─ Exception ───────────────────────────────────────────────┐');
      console.log(`  │  Code:      ${hex(ex.code, 8)}  →  ${ex.codeDesc}`);
      console.log(`  │  Address:   0x${ex.address.toString(16).toUpperCase().padStart(16, '0')}`);
      console.log(`  │  Thread ID: ${ex.threadId}`);
      if (ex.code === 0xC0000005 && ex.params.length >= 2) {
        // ACCESS_VIOLATION: param[0] = 0=read / 1=write / 8=DEP, param[1] = bad address
        const ops = { 0n: 'read from', 1n: 'write to', 8n: 'execute at' };
        const op  = ops[ex.params[0]] ?? `access (${ex.params[0]})`;
        console.log(`  │  → Tried to ${op} 0x${ex.params[1].toString(16).toUpperCase().padStart(16, '0')}`);
      }
      console.log('  └───────────────────────────────────────────────────────────┘');
    }
  } else {
    console.log('  (no ExceptionStream found)');
  }

  // ── PID ────────────────────────────────────────────────────────────────────
  if (streams[15]) {
    const misc = parseMiscInfo(buf, streams[15].rva);
    if (misc?.pid) console.log(`  PID:       ${misc.pid}`);
  }

  // ── Modules ────────────────────────────────────────────────────────────────
  if (streams[4]) {
    const modules = parseModuleList(buf, streams[4].rva);
    if (modules.length > 0) {
      console.log('');
      console.log('  ── Loaded Modules (app / runtime) ─────────────────────────');
      // Show app-relevant modules first; fall back to first 25 if nothing matches
      const highlight = modules.filter(m =>
        /electron|openconduit|node|v8|libc\+\+|libsystem_c|libdyld|dyld|chrome|ffmpeg/i.test(m.name)
      );
      const toShow = highlight.length > 0 ? highlight : modules.slice(0, 25);
      for (const m of toShow) {
        const shortName = m.name.split(/[\\/]/).pop() ?? m.name;
        const baseStr   = '0x' + m.base.toString(16).toUpperCase();
        const sizeStr   = `(${(m.size / 1024).toFixed(0)} KB)`.padStart(10);
        console.log(`  ${baseStr.padEnd(20)} ${sizeStr}  ${shortName}`);
      }
      if (modules.length > toShow.length) {
        console.log(`  … and ${modules.length - toShow.length} more modules`);
      }
      console.log(`  Total: ${modules.length} modules`);
    }
  }
}

// ─── Stack trace via lldb or minidump_stackwalk ───────────────────────────────

/** Try minidump_stackwalk (needs `brew install google-breakpad` *tools* build). */
function tryStackwalk(filePath) {
  for (const cmd of ['minidump_stackwalk', '/opt/homebrew/bin/minidump_stackwalk', '/usr/local/bin/minidump_stackwalk']) {
    try {
      const r = spawnSync(cmd, [filePath], { encoding: 'utf-8', timeout: 20_000, maxBuffer: 4 * 1024 * 1024 });
      if (r.stdout || r.status === 0) return { tool: 'minidump_stackwalk', output: r.stdout || r.stderr || '' };
    } catch { /* not available */ }
  }
  return null;
}

/**
 * Use lldb (ships with Xcode CLT) to load the minidump and run:
 *   bt all   — all-threads backtrace
 *   register read — registers of crashing thread
 */
function tryLldb(filePath) {
  const lldb = spawnSync('which', ['lldb'], { encoding: 'utf-8' });
  if (lldb.status !== 0) return null;

  // Feed commands via stdin so we don't need a TTY
  const commands = [
    'bt all',
    'register read',
    'quit',
  ].join('\n');

  const r = spawnSync('lldb', ['--core', filePath], {
    input:     commands,
    encoding:  'utf-8',
    timeout:   30_000,
    maxBuffer: 8 * 1024 * 1024,
  });

  const out = (r.stdout || '') + (r.stderr || '');
  return out.trim() ? { tool: 'lldb', output: out } : null;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

for (const arg of args) {
  console.log('');
  console.log('═'.repeat(72));
  try {
    analyzeDump(arg);

    const result = tryStackwalk(arg) ?? tryLldb(arg);
    if (result) {
      console.log('');
      console.log(`  ── Stack trace (${result.tool}) ${'─'.repeat(Math.max(0, 47 - result.tool.length))}`);
      const lines = result.output.split('\n');
      for (const line of lines.slice(0, 150)) {
        console.log('  ' + line);
      }
      if (lines.length > 150) {
        console.log(`  … (${lines.length - 150} more lines)`);
      }
      if (result.tool === 'lldb') {
        console.log('');
        console.log('  ╌ Frames show only addresses because Electron Framework is stripped.');
        console.log('  ╌ To get symbols, download:');
        console.log('  ╌   https://github.com/electron/electron/releases/download/v<VERSION>/electron-v<VERSION>-darwin-arm64-dsym.zip');
        console.log('  ╌ Extract the .dSYM bundle next to the app and re-run.');
      }
    } else {
      console.log('');
      console.log('  ╌ No stack-trace tool found. Install Xcode CLT for lldb:');
      console.log('  ╌   xcode-select --install');
    }
  } catch (err) {
    console.error(`  Error reading file: ${err.message}`);
  }
}
console.log('');
