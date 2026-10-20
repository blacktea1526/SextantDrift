import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveGoModulePath, GO_STDLIB_MODULES, clearGoModuleCache } from '../../src/analyzer/go-resolver.js';

describe('Go module resolver (go-resolver)', () => {
  it('classifies the standard library and cgo as external', () => {
    expect(GO_STDLIB_MODULES.has('fmt')).toBe(true);
    expect(GO_STDLIB_MODULES.has('net')).toBe(true);

    expect(resolveGoModulePath('/test/root', 'cmd/main.go', 'fmt')).toMatchObject({
      type: 'external',
      packageName: 'fmt',
    });
    expect(resolveGoModulePath('/test/root', 'cmd/main.go', 'net/http')).toMatchObject({
      type: 'external',
      packageName: 'net/http',
    });
    expect(resolveGoModulePath('/test/root', 'cmd/main.go', 'C')).toMatchObject({
      type: 'external',
      packageName: 'C',
    });
  });

  it('resolves a module-internal package to a non-test Go file', () => {
    const scannedFiles = new Set([
      'cmd/api/main.go',
      'internal/order/service_test.go',
      'internal/order/service.go',
    ]);

    const resolved = resolveGoModulePath('/test/root', 'cmd/api/main.go', 'example.com/shop/internal/order', {
      scannedFiles,
      modulePath: 'example.com/shop',
    });

    expect(resolved).toMatchObject({
      type: 'internal',
      targetPath: 'internal/order/service.go',
      fullPath: '/test/root/internal/order/service.go',
    });
  });

  it('keeps third-party modules and v2 module paths external', () => {
    const scannedFiles = new Set(['cmd/main.go', 'v2/foo.go']);
    const options = { scannedFiles, modulePath: 'example.com/shop' };

    expect(resolveGoModulePath('/test/root', 'cmd/main.go', 'github.com/lib/pq', options)).toMatchObject({
      type: 'external',
      packageName: 'github.com/lib/pq',
    });
    expect(resolveGoModulePath('/test/root', 'cmd/main.go', 'example.com/shop/v2/foo', options)).toMatchObject({
      type: 'external',
      packageName: 'example.com/shop/v2/foo',
    });
  });

  it('reports a missing in-module package as unresolved', () => {
    const resolved = resolveGoModulePath('/test/root', 'cmd/main.go', 'example.com/shop/missing', {
      scannedFiles: new Set(['cmd/main.go']),
      modulePath: 'example.com/shop',
    });
    expect(resolved.type).toBe('unresolved');
  });

  describe('go.mod on disk', () => {
    let rootDir: string;

    beforeEach(() => {
      clearGoModuleCache();
      rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-go-mod-'));
    });

    afterEach(() => {
      fs.rmSync(rootDir, { recursive: true, force: true });
    });

    it('reads the nearest go.mod, including a local replace', () => {
      fs.mkdirSync(path.join(rootDir, 'services/cmd'), { recursive: true });
      fs.mkdirSync(path.join(rootDir, 'services/third_party/lib/store'), { recursive: true });
      fs.writeFileSync(
        path.join(rootDir, 'go.mod'),
        'module example.com/root\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(rootDir, 'services/go.mod'),
        `module example.com/svc

go 1.22

require (
	github.com/lib/pq v1.10.9
)

replace (
	// local fork
	example.com/lib v1.2.3 => ./third_party/lib
)
`,
        'utf-8'
      );
      fs.writeFileSync(path.join(rootDir, 'services/cmd/main.go'), 'package main\n', 'utf-8');
      fs.writeFileSync(
        path.join(rootDir, 'services/third_party/lib/store/store.go'),
        'package store\n',
        'utf-8'
      );

      const resolved = resolveGoModulePath(rootDir, 'services/cmd/main.go', 'example.com/lib/store');
      expect(resolved).toMatchObject({
        type: 'internal',
        targetPath: 'services/third_party/lib/store/store.go',
      });
    });

    it('does not follow a replace that leaves the project root', () => {
      fs.writeFileSync(
        path.join(rootDir, 'go.mod'),
        'module example.com/app\n\nreplace example.com/lib => ../outside\n',
        'utf-8'
      );
      fs.writeFileSync(path.join(rootDir, 'main.go'), 'package main\n', 'utf-8');

      const resolved = resolveGoModulePath(rootDir, 'main.go', 'example.com/lib');
      expect(resolved.type).toBe('unresolved');
    });
  });
});
