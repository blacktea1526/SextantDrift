import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFileDrift } from '../src/index.js';

describe('Incremental File Guardrail (checkFileDrift)', () => {
  const fixtureDir = path.resolve(__dirname, 'fixtures/clean-layered-app');

  it('should return valid: true for compliant file content', () => {
    const compliantContent = `
import { UserService } from '../services/user.service.js';

export class UserController {
  constructor(private service: UserService) {}
}
`;
    const res = checkFileDrift({
      rootDir: fixtureDir,
      filePath: 'src/controllers/user.controller.ts',
      fileContent: compliantContent,
    });

    expect(res.valid).toBe(true);
    expect(res.violations).toHaveLength(0);
    expect(res.componentId).toBe('Controller');
    expect(res.layerId).toBe('UI');
    expect(res.durationMs).toBeLessThan(150); // Fast incremental check
  });

  it('should detect layer bypass in real-time before writing to disk', () => {
    // Controller directly imports Repository, bypassing Domain/Service
    const bypassContent = `
import { UserRepo } from '../repos/user.repo.js';

export class UserController {
  private repo = new UserRepo();
}
`;
    const res = checkFileDrift({
      rootDir: fixtureDir,
      filePath: 'src/controllers/order.controller.ts',
      fileContent: bypassContent,
    });

    expect(res.valid).toBe(false);
    expect(res.violations.length).toBeGreaterThan(0);
    const bypass = res.violations.find((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypass).toBeDefined();
    expect(bypass?.sourceComponent).toBe('Controller');
    expect(bypass?.targetComponent).toBe('Repo');
    expect(res.steeringAdvice).toBeDefined();
    expect(res.steeringAdvice).toContain('Domain');
  });

  it('should detect layer inversion in real-time', () => {
    // Repo imports Controller
    const inversionContent = `
import { UserController } from '../controllers/user.controller.js';

export class UserRepo {}
`;
    const res = checkFileDrift({
      rootDir: fixtureDir,
      filePath: 'src/repos/user.repo.ts',
      fileContent: inversionContent,
    });

    expect(res.valid).toBe(false);
    const inversion = res.violations.find((v) => v.type === 'CRITICAL_INVERSION');
    expect(inversion).toBeDefined();
    expect(inversion?.sourceComponent).toBe('Repo');
    expect(inversion?.targetComponent).toBe('Controller');
  });

  it('should detect forbidden import in real-time', () => {
    const driftedDir = path.resolve(__dirname, 'fixtures/drifted-bypass-app');
    const forbiddenContent = `
import { PrismaClient } from '@prisma/client';

export class BadController {}
`;
    const res = checkFileDrift({
      rootDir: driftedDir,
      filePath: 'src/controllers/user.controller.ts',
      fileContent: forbiddenContent,
    });

    expect(res.valid).toBe(false);
    const forbidden = res.violations.find((v) => v.type === 'CRITICAL_FORBIDDEN_IMPORT');
    expect(forbidden).toBeDefined();
    expect(forbidden?.snippet).toContain('@prisma/client');
  });

  it('detects a Go layer bypass from unsaved file content', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-go-check-file-'));
    try {
      fs.mkdirSync(path.join(rootDir, 'internal/store'), { recursive: true });
      fs.writeFileSync(path.join(rootDir, 'go.mod'), 'module github.com/acme/shop\n\ngo 1.22\n', 'utf-8');
      fs.writeFileSync(path.join(rootDir, 'internal/store/db.go'), 'package store\n\nfunc Save(sku string) {}\n', 'utf-8');
      fs.writeFileSync(
        path.join(rootDir, 'sextant.json'),
        JSON.stringify({
          name: 'Go Shop',
          version: '1.0.0',
          layers: [
            { id: 'presentation', order: 1, name: 'Presentation Layer' },
            { id: 'domain', order: 2, name: 'Business Domain Layer' },
            { id: 'infrastructure', order: 3, name: 'Infrastructure Layer' },
          ],
          components: [
            { id: 'http-api', layerId: 'presentation', paths: ['cmd/api/**'] },
            { id: 'order-service', layerId: 'domain', paths: ['internal/order/**'] },
            { id: 'order-store', layerId: 'infrastructure', paths: ['internal/store/**'] },
          ],
        }),
        'utf-8'
      );

      const res = checkFileDrift({
        rootDir,
        filePath: 'cmd/api/main.go',
        fileContent: `package main

import "github.com/acme/shop/internal/store"

func main() { store.Save("sku") }
`,
      });

      expect(res.valid).toBe(false);
      expect(res.componentId).toBe('http-api');
      const bypass = res.violations.find((item) => item.type === 'CRITICAL_BYPASS');
      expect(bypass).toMatchObject({
        sourceFile: 'cmd/api/main.go',
        targetComponent: 'order-store',
      });
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
