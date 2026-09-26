import path from 'node:path';
import fs from 'node:fs';
import { ResolvedTarget, normalizePath } from './path-resolver.js';

export interface PythonResolverOptions {
  scannedFiles?: Set<string>;
  pythonRoots?: string[];
}

/**
 * Standard Python 3 built-in and standard library modules.
 */
export const PYTHON_STDLIB_MODULES = new Set<string>([
  'abc',
  'aifc',
  'argparse',
  'array',
  'ast',
  'asynchat',
  'asyncio',
  'asyncore',
  'atexit',
  'audioop',
  'base64',
  'bdb',
  'binascii',
  'binhex',
  'bisect',
  'builtins',
  'bz2',
  'cProfile',
  'calendar',
  'cgi',
  'cgitb',
  'chunk',
  'cmath',
  'cmd',
  'code',
  'codecs',
  'codeop',
  'collections',
  'colorsys',
  'compileall',
  'concurrent',
  'configparser',
  'contextlib',
  'contextvars',
  'copy',
  'copyreg',
  'crypt',
  'csv',
  'ctypes',
  'curses',
  'dataclasses',
  'datetime',
  'dbm',
  'decimal',
  'difflib',
  'dis',
  'distutils',
  'doctest',
  'email',
  'encodings',
  'ensurepip',
  'enum',
  'errno',
  'faulthandler',
  'fcntl',
  'filecmp',
  'fileinput',
  'fnmatch',
  'fractions',
  'ftplib',
  'functools',
  'gc',
  'getopt',
  'getpass',
  'gettext',
  'glob',
  'graphlib',
  'grp',
  'gzip',
  'hashlib',
  'heapq',
  'hmac',
  'html',
  'http',
  'imaplib',
  'imghdr',
  'imp',
  'importlib',
  'inspect',
  'io',
  'ipaddress',
  'itertools',
  'json',
  'keyword',
  'linecache',
  'locale',
  'logging',
  'lzma',
  'mailbox',
  'mailcap',
  'marshal',
  'math',
  'mimetypes',
  'mmap',
  'modulefinder',
  'msilib',
  'msvcrt',
  'multiprocessing',
  'netrc',
  'nis',
  'nntplib',
  'numbers',
  'operator',
  'optparse',
  'os',
  'ossaudiodev',
  'parser',
  'pathlib',
  'pdb',
  'pickle',
  'pickletools',
  'pipes',
  'pkgutil',
  'platform',
  'plistlib',
  'poplib',
  'posix',
  'posixpath',
  'pprint',
  'profile',
  'pstats',
  'pty',
  'pwd',
  'py_compile',
  'pyclbr',
  'pydoc',
  'queue',
  'quopri',
  'random',
  're',
  'readline',
  'reprlib',
  'resource',
  'rlcompleter',
  'runpy',
  'sched',
  'secrets',
  'select',
  'selectors',
  'shelve',
  'shlex',
  'shutil',
  'signal',
  'site',
  'smtpd',
  'smtplib',
  'sndhdr',
  'socket',
  'socketserver',
  'spwd',
  'sqlite3',
  'ssl',
  'stat',
  'statistics',
  'string',
  'stringprep',
  'struct',
  'subprocess',
  'sunau',
  'symbol',
  'symtable',
  'sys',
  'sysconfig',
  'syslog',
  'tabnanny',
  'tarfile',
  'telnetlib',
  'tempfile',
  'termios',
  'test',
  'textwrap',
  'threading',
  'time',
  'timeit',
  'tkinter',
  'token',
  'tokenize',
  'tomllib',
  'trace',
  'traceback',
  'tracemalloc',
  'tty',
  'turtle',
  'turtledemo',
  'types',
  'typing',
  'typing_extensions',
  'unicodedata',
  'unittest',
  'urllib',
  'uu',
  'uuid',
  'venv',
  'warnings',
  'wave',
  'weakref',
  'webbrowser',
  'winreg',
  'winsound',
  'wsgiref',
  'xdrlib',
  'xml',
  'xmlrpc',
  'zipapp',
  'zipfile',
  'zipimport',
  'zlib',
  '_thread',
]);

const DEFAULT_PYTHON_ROOTS = ['', 'src', 'lib', 'backend', 'app'];

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Resolves a Python module import specifier into an internal file, external package, or unresolved diagnostic.
 */
export function resolvePythonModulePath(
  rootDir: string,
  sourceFilePath: string,
  rawSpecifier: string,
  options?: PythonResolverOptions
): ResolvedTarget {
  const normSource = toPosix(sourceFilePath);
  const scanned = options?.scannedFiles;

  function candidateExists(relCandidate: string): boolean {
    const norm = toPosix(relCandidate);
    if (scanned) {
      return scanned.has(norm);
    }
    const full = path.resolve(rootDir, norm);
    return fs.existsSync(full);
  }

  // 1. Check relative imports (e.g. '.', '.helper', '..models', '...core.config')
  const dotMatch = rawSpecifier.match(/^(\.+)(.*)$/);
  if (dotMatch) {
    const dotCount = dotMatch[1].length;
    const remainder = dotMatch[2];

    let baseDir = path.posix.dirname(normSource);
    // 1 dot = current directory; 2 dots = parent; 3 dots = grandparent
    for (let d = 1; d < dotCount; d++) {
      baseDir = path.posix.dirname(baseDir);
    }

    if (baseDir.startsWith('..')) {
      return {
        type: 'unresolved',
        rawSpecifier,
        reason: `Relative import "${rawSpecifier}" in "${sourceFilePath}" traverses outside project root`,
        sourceFile: sourceFilePath,
      };
    }

    const subpath = remainder ? remainder.split('.').join('/') : '';
    const candidateBase = subpath ? path.posix.join(baseDir, subpath) : baseDir;

    const candidates = [
      `${candidateBase}.py`,
      `${candidateBase}/__init__.py`,
    ];

    for (const cand of candidates) {
      if (candidateExists(cand)) {
        return {
          type: 'internal',
          targetPath: normalizePath(cand),
          fullPath: path.resolve(rootDir, cand),
        };
      }
    }

    return {
      type: 'unresolved',
      rawSpecifier,
      reason: `Relative Python module "${rawSpecifier}" not found (probed: ${candidates.join(', ')})`,
      sourceFile: sourceFilePath,
    };
  }

  // 2. Check standard library modules
  const topLevel = rawSpecifier.split('.')[0];
  if (PYTHON_STDLIB_MODULES.has(topLevel)) {
    return {
      type: 'external',
      packageName: rawSpecifier,
      rawSpecifier,
    };
  }

  // 3. Check internal absolute project candidates
  const subpath = rawSpecifier.split('.').join('/');
  const scriptDir = path.posix.dirname(normSource);

  // Collect candidate search roots
  const rootsToProbe = new Set<string>();
  rootsToProbe.add(scriptDir);
  for (const r of options?.pythonRoots ?? DEFAULT_PYTHON_ROOTS) {
    rootsToProbe.add(r);
  }

  // If scannedFiles has paths matching `<topDir>/...`, add `<topDir>`
  if (scanned) {
    for (const f of scanned) {
      const parts = f.split('/');
      if (parts.length > 1 && parts[1] === topLevel) {
        rootsToProbe.add(parts[0]);
      }
    }
  }

  for (const root of rootsToProbe) {
    const candidateBase = root ? path.posix.join(root, subpath) : subpath;
    const candidates = [
      `${candidateBase}.py`,
      `${candidateBase}/__init__.py`,
    ];

    for (const cand of candidates) {
      if (candidateExists(cand)) {
        return {
          type: 'internal',
          targetPath: normalizePath(cand),
          fullPath: path.resolve(rootDir, cand),
        };
      }
    }
  }

  // 4. Default to external 3rd-party pip dependency
  return {
    type: 'external',
    packageName: topLevel,
    rawSpecifier,
  };
}
