import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

export interface ResolvedVitest {
  version: string;
  packageDir: string;
  vitestMjsPath: string;
  runnersPath: string;
}

export type ResolveVitestResult =
  | { success: true; vitest: ResolvedVitest }
  | { success: false; error: string };

/**
 * Resolves local Vitest v2.1.x installation strictly from the target rootDir's node_modules.
 * Rejects absent packages and unsupported versions.
 */
export function resolveLocalVitest(rootDir: string): ResolveVitestResult {
  let req: NodeRequire;
  try {
    const dummyPath = path.join(rootDir, 'package.json');
    req = createRequire(dummyPath);
  } catch (err) {
    return {
      success: false,
      error: `Failed to initialize module loader in root directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let pkgJsonPath: string;
  try {
    pkgJsonPath = req.resolve('vitest/package.json');
  } catch {
    return {
      success: false,
      error: `Vitest not found in ${rootDir}/node_modules. Local Vitest v2.1.x is required.`,
    };
  }

  let pkgContent: { version?: string; bin?: Record<string, string> };
  try {
    pkgContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  } catch (err) {
    return {
      success: false,
      error: `Failed to read Vitest package.json at ${pkgJsonPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const version = pkgContent.version;
  if (!version || !/^2\.1\./.test(version)) {
    return {
      success: false,
      error: `Unsupported Vitest version ${version ?? 'unknown'}. Expected local Vitest v2.1.x.`,
    };
  }

  const packageDir = path.dirname(pkgJsonPath);
  const vitestMjsRel = pkgContent.bin?.vitest ?? 'vitest.mjs';
  const vitestMjsPath = path.resolve(packageDir, vitestMjsRel);

  if (!fs.existsSync(vitestMjsPath)) {
    return {
      success: false,
      error: `Vitest executable entrypoint not found at ${vitestMjsPath}`,
    };
  }

  let runnersPath: string;
  try {
    runnersPath = req.resolve('vitest/runners');
  } catch (err) {
    return {
      success: false,
      error: `Failed to resolve vitest/runners from ${rootDir}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    success: true,
    vitest: {
      version,
      packageDir,
      vitestMjsPath,
      runnersPath,
    },
  };
}
