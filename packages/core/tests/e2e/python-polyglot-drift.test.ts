import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { analyzeModuleDrift } from '../../src/index.js';
import { TargetArchitecture } from '../../src/types/architecture.js';

describe('E2E Polyglot Architecture Drift Verification (TypeScript + Python)', () => {
  function createTempProject(files: Record<string, string>, arch: TargetArchitecture) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-polyglot-test-'));

    // Write files
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = path.join(tempDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    // Write sextant.json
    fs.writeFileSync(
      path.join(tempDir, 'sextant.json'),
      JSON.stringify(arch, null, 2),
      'utf-8'
    );

    return {
      rootDir: tempDir,
      cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
    };
  }

  const baseArch: TargetArchitecture = {
    name: 'Polyglot System',
    version: '1.0.0',
    layers: [
      { id: 'presentation', order: 1, name: 'Presentation Layer' },
      { id: 'domain', order: 2, name: 'Business Domain Layer' },
      { id: 'infrastructure', order: 3, name: 'Infrastructure Layer' },
    ],
    components: [
      {
        id: 'web-api',
        layerId: 'presentation',
        paths: ['src/api/**'],
      },
      {
        id: 'admin-cli',
        layerId: 'presentation',
        paths: ['backend/cli/**'],
        forbiddenImports: ['infra/**', 'psycopg2'],
      },
      {
        id: 'domain-services',
        layerId: 'domain',
        paths: ['backend/services/**'],
      },
      {
        id: 'infra-repo',
        layerId: 'infrastructure',
        paths: ['backend/infra/**'],
      },
    ],
  };

  it('passes verification on clean compliant polyglot code with 0 drifts', async () => {
    const files = {
      // TypeScript API (Layer 1) -> calls domain service
      'src/api/order-controller.ts': `
import { processOrder } from '../client/order-client';
export function handlePost() { processOrder(); }
`,
      'src/api/client/order-client.ts': `
export function processOrder() { return true; }
`,
      // Python CLI (Layer 1) -> imports domain service (Layer 2)
      'backend/cli/main.py': `
import sys
from backend.services.order_service import create_order

def main():
    create_order("item-123")
`,
      // Python Domain Service (Layer 2) -> imports infrastructure (Layer 3)
      'backend/services/order_service.py': `
from backend.infra.database import save_record

def create_order(item_id: str):
    return save_record({"item": item_id})
`,
      // Python Infra Repo (Layer 3)
      'backend/infra/database.py': `
def save_record(data: dict):
    return {"status": "saved", "data": data}
`,
    };

    const proj = createTempProject(files, baseArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });

      expect(report.passed).toBe(true);
      expect(report.summary.totalViolations).toBe(0);
      expect(report.summary.totalFiles).toBe(5);
      expect(report.summary.totalDependencies).toBeGreaterThan(0);
    } finally {
      proj.cleanup();
    }
  });

  it('detects cross-layer bypass in Python (Layer 1 bypassing Layer 2 to Layer 3)', async () => {
    const files = {
      'src/api/dummy.ts': `export const dummy = 1;`,
      // Python CLI (Layer 1: presentation) directly imports database (Layer 3: infrastructure)
      'backend/cli/main.py': `
import sys
from backend.infra.database import save_record

def bad_direct_db_call():
    save_record({"bypass": True})
`,
      'backend/services/order_service.py': `
def valid_service():
    pass
`,
      'backend/infra/database.py': `
def save_record(data):
    pass
`,
    };

    const proj = createTempProject(files, baseArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });

      expect(report.passed).toBe(false);
      expect(report.summary.bypassCount).toBeGreaterThan(0);

      const bypass = report.violations.find((v) => v.type === 'CRITICAL_BYPASS');
      expect(bypass).toBeDefined();
      expect(bypass?.sourceFile).toBe('backend/cli/main.py');
      expect(bypass?.sourceComponent).toBe('admin-cli');
      expect(bypass?.targetComponent).toBe('infra-repo');
      expect(bypass?.line).toBe(3);
    } finally {
      proj.cleanup();
    }
  });

  it('detects circular dependencies across Python modules (Tarjan SCC)', async () => {
    const cycleArch: TargetArchitecture = {
      name: 'Python Cycle System',
      version: '1.0.0',
      layers: [
        { id: 'domain', order: 1, name: 'Domain' },
      ],
      components: [
        { id: 'billing-comp', layerId: 'domain', paths: ['services/billing/**'] },
        { id: 'order-comp', layerId: 'domain', paths: ['services/order/**'] },
      ],
    };

    const files = {
      'services/billing/billing_service.py': `
from services.order.order_service import get_order_total

def bill_customer():
    return get_order_total()
`,
      'services/order/order_service.py': `
from services.billing.billing_service import bill_customer

def get_order_total():
    return 100
`,
    };

    const proj = createTempProject(files, cycleArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });

      expect(report.passed).toBe(false);
      expect(report.summary.cycleCount).toBe(1);

      const cycle = report.violations.find((v) => v.type === 'CRITICAL_CYCLE');
      expect(cycle).toBeDefined();
      expect(cycle?.cycle).toContain('billing-comp');
      expect(cycle?.cycle).toContain('order-comp');
    } finally {
      proj.cleanup();
    }
  });

  it('detects forbidden 3rd-party library imports in Python modules', async () => {
    const files = {
      'src/api/dummy.ts': `export const ok = true;`,
      // admin-cli has forbiddenImports: ['infra/**', 'psycopg2']
      'backend/cli/worker.py': `
import psycopg2

def direct_connect():
    conn = psycopg2.connect("...")
`,
      'backend/services/svc.py': `
def svc(): pass
`,
      'backend/infra/db.py': `
def db(): pass
`,
    };

    const proj = createTempProject(files, baseArch);
    try {
      const report = await analyzeModuleDrift({ rootDir: proj.rootDir });

      expect(report.passed).toBe(false);
      const forbidden = report.violations.find((v) => v.type === 'CRITICAL_FORBIDDEN_IMPORT');
      expect(forbidden).toBeDefined();
      expect(forbidden?.sourceFile).toBe('backend/cli/worker.py');
      expect(forbidden?.snippet).toContain('psycopg2');
    } finally {
      proj.cleanup();
    }
  });
});
