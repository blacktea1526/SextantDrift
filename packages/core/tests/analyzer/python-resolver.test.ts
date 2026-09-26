import { describe, it, expect } from 'vitest';
import { resolvePythonModulePath, PYTHON_STDLIB_MODULES } from '../../src/analyzer/python-resolver.js';

describe('Python Module Resolver (python-resolver)', () => {
  it('identifies standard library modules as external', () => {
    expect(PYTHON_STDLIB_MODULES.has('os')).toBe(true);
    expect(PYTHON_STDLIB_MODULES.has('sys')).toBe(true);
    expect(PYTHON_STDLIB_MODULES.has('typing')).toBe(true);
    expect(PYTHON_STDLIB_MODULES.has('asyncio')).toBe(true);

    const resOs = resolvePythonModulePath('/test/root', 'app/main.py', 'os');
    expect(resOs).toMatchObject({
      type: 'external',
      packageName: 'os',
    });

    const resJson = resolvePythonModulePath('/test/root', 'app/main.py', 'json');
    expect(resJson).toMatchObject({
      type: 'external',
      packageName: 'json',
    });

    const resSub = resolvePythonModulePath('/test/root', 'app/main.py', 'urllib.request');
    expect(resSub).toMatchObject({
      type: 'external',
      packageName: 'urllib.request',
    });
  });

  it('resolves relative imports within the same directory', () => {
    const scannedFiles = new Set([
      'services/billing/worker.py',
      'services/billing/helper.py',
      'services/billing/__init__.py',
    ]);

    const res = resolvePythonModulePath(
      '/test/root',
      'services/billing/worker.py',
      '.helper',
      { scannedFiles }
    );

    expect(res).toMatchObject({
      type: 'internal',
      targetPath: 'services/billing/helper',
      fullPath: '/test/root/services/billing/helper.py',
    });
  });

  it('resolves parent relative imports (..)', () => {
    const scannedFiles = new Set([
      'services/billing/worker.py',
      'services/models/user.py',
      'services/common.py',
    ]);

    const resModels = resolvePythonModulePath(
      '/test/root',
      'services/billing/worker.py',
      '..models.user',
      { scannedFiles }
    );

    expect(resModels).toMatchObject({
      type: 'internal',
      targetPath: 'services/models/user',
      fullPath: '/test/root/services/models/user.py',
    });

    const resCommon = resolvePythonModulePath(
      '/test/root',
      'services/billing/worker.py',
      '..common',
      { scannedFiles }
    );

    expect(resCommon).toMatchObject({
      type: 'internal',
      targetPath: 'services/common',
      fullPath: '/test/root/services/common.py',
    });
  });

  it('resolves absolute internal project imports across candidate roots', () => {
    const scannedFiles = new Set([
      'src/services/billing/invoice.py',
      'src/services/billing/__init__.py',
      'src/infra/db.py',
    ]);

    // From root / src root: services.billing.invoice
    const res = resolvePythonModulePath(
      '/test/root',
      'src/controller.py',
      'services.billing.invoice',
      { scannedFiles }
    );

    expect(res).toMatchObject({
      type: 'internal',
      targetPath: 'src/services/billing/invoice',
      fullPath: '/test/root/src/services/billing/invoice.py',
    });

    // Package __init__ import: services.billing
    const resPkg = resolvePythonModulePath(
      '/test/root',
      'src/controller.py',
      'services.billing',
      { scannedFiles }
    );

    expect(resPkg).toMatchObject({
      type: 'internal',
      targetPath: 'src/services/billing',
      fullPath: '/test/root/src/services/billing/__init__.py',
    });
  });

  it('classifies unknown non-internal non-stdlib packages as external 3rd-party dependencies', () => {
    const scannedFiles = new Set(['app/main.py']);

    const resFastapi = resolvePythonModulePath('/test/root', 'app/main.py', 'fastapi', {
      scannedFiles,
    });
    expect(resFastapi).toMatchObject({
      type: 'external',
      packageName: 'fastapi',
    });

    const resPydantic = resolvePythonModulePath(
      '/test/root',
      'app/main.py',
      'pydantic.BaseModel',
      { scannedFiles }
    );
    expect(resPydantic).toMatchObject({
      type: 'external',
      packageName: 'pydantic',
    });
  });

  it('returns unresolved for invalid relative imports that do not exist', () => {
    const scannedFiles = new Set(['services/billing/worker.py']);

    const res = resolvePythonModulePath(
      '/test/root',
      'services/billing/worker.py',
      '..nonexistent.module',
      { scannedFiles }
    );

    expect(res.type).toBe('unresolved');
  });
});
