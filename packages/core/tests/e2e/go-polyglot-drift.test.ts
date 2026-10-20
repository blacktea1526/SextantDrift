import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { analyzeModuleDrift } from '../../src/index.js';
import { TargetArchitecture } from '../../src/types/architecture.js';

describe('E2E Go architecture drift', () => {
  function createTempProject(files: Record<string, string>, arch: TargetArchitecture) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-go-drift-'));
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = path.join(tempDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
    fs.writeFileSync(path.join(tempDir, 'sextant.json'), JSON.stringify(arch, null, 2), 'utf-8');
    return {
      rootDir: tempDir,
      cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
    };
  }

  const baseArch: TargetArchitecture = {
    name: 'Go Shop',
    version: '1.0.0',
    layers: [
      { id: 'presentation', order: 1, name: 'Presentation Layer' },
      { id: 'domain', order: 2, name: 'Business Domain Layer' },
      { id: 'infrastructure', order: 3, name: 'Infrastructure Layer' },
    ],
    components: [
      {
        id: 'http-api',
        layerId: 'presentation',
        paths: ['cmd/api/**'],
        forbiddenImports: ['github.com/lib/pq'],
      },
      {
        id: 'order-service',
        layerId: 'domain',
        paths: ['internal/order/**'],
      },
      {
        id: 'order-store',
        layerId: 'infrastructure',
        paths: ['internal/store/**'],
      },
    ],
    allowDependencies: [],
  };

  const goMod = 'module github.com/acme/shop\n\ngo 1.22\n';

  it('accepts a layered Go module with no drift', async () => {
    const files = {
      'go.mod': goMod,
      'cmd/api/main.go': `package main

import "github.com/acme/shop/internal/order"

func main() { order.Create("sku") }
`,
      'internal/order/service.go': `package order

import "github.com/acme/shop/internal/store"

func Create(sku string) { store.Save(sku) }
`,
      'internal/store/db.go': `package store

import "fmt"

func Save(sku string) { fmt.Println(sku) }
`,
    };

    const proj = createTempProject(files, baseArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });
      expect(report.passed).toBe(true);
      expect(report.summary.totalViolations).toBe(0);
      expect(report.summary.totalFiles).toBe(3);
      expect(report.summary.unresolvedImportCount).toBe(0);
      expect(report.summary.totalDependencies).toBeGreaterThan(0);
    } finally {
      proj.cleanup();
    }
  });

  it('detects a presentation package that bypasses the domain layer', async () => {
    const files = {
      'go.mod': goMod,
      'cmd/api/main.go': `package main

import "github.com/acme/shop/internal/store"

func main() { store.Save("sku") }
`,
      'internal/order/service.go': `package order

func Create(sku string) {}
`,
      'internal/store/db.go': `package store

func Save(sku string) {}
`,
    };

    const proj = createTempProject(files, baseArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });
      expect(report.passed).toBe(false);
      const bypass = report.violations.find((item) => item.type === 'CRITICAL_BYPASS');
      expect(bypass).toMatchObject({
        sourceFile: 'cmd/api/main.go',
        sourceComponent: 'http-api',
        targetComponent: 'order-store',
        line: 3,
      });
    } finally {
      proj.cleanup();
    }
  });

  it('detects a cycle between two Go packages', async () => {
    const cycleArch: TargetArchitecture = {
      name: 'Go Cycle',
      version: '1.0.0',
      layers: [{ id: 'domain', order: 1, name: 'Domain' }],
      components: [
        { id: 'billing-comp', layerId: 'domain', paths: ['services/billing/**'] },
        { id: 'order-comp', layerId: 'domain', paths: ['services/order/**'] },
      ],
      allowDependencies: [],
    };
    const files = {
      'go.mod': 'module example.com/shop\n\ngo 1.22\n',
      'services/billing/billing.go': `package billing

import "example.com/shop/services/order"

func Bill() { order.Total() }
`,
      'services/order/order.go': `package order

import "example.com/shop/services/billing"

func Total() int { billing.Bill(); return 1 }
`,
    };

    const proj = createTempProject(files, cycleArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });
      expect(report.passed).toBe(false);
      expect(report.summary.cycleCount).toBe(1);
      const cycle = report.violations.find((item) => item.type === 'CRITICAL_CYCLE');
      expect(cycle?.cycle).toEqual(expect.arrayContaining(['billing-comp', 'order-comp']));
    } finally {
      proj.cleanup();
    }
  });

  it('detects a forbidden third-party Go module', async () => {
    const files = {
      'go.mod': goMod,
      'cmd/api/main.go': `package main

import "github.com/lib/pq"

func main() { _ = pq.ErrSSLNotSupported }
`,
      'internal/order/service.go': 'package order\n',
      'internal/store/db.go': 'package store\n',
    };

    const proj = createTempProject(files, baseArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });
      expect(report.passed).toBe(false);
      const forbidden = report.violations.find((item) => item.type === 'CRITICAL_FORBIDDEN_IMPORT');
      expect(forbidden?.sourceFile).toBe('cmd/api/main.go');
      expect(forbidden?.snippet).toContain('github.com/lib/pq');
    } finally {
      proj.cleanup();
    }
  });
});
