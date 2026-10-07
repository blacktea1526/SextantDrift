import fs from 'node:fs';
import path from 'node:path';

export const CONSTRAINT_UNITS_DIR = '.sextant/units';

export type ScaffoldLanguage = 'ts' | 'py';

export interface ScaffoldLayer {
  id: string;
  order: number;
}

export interface ScaffoldComponent {
  id: string;
  name: string;
  layerId: string;
  paths: string[];
  technology: string;
  description: string;
}

export interface ScaffoldResult {
  written: string[];
  skipped: string[];
  components: ScaffoldComponent[];
  language: ScaffoldLanguage;
}

function pascalCase(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function probeFnNameTs(layerId: string): string {
  return `probe${pascalCase(layerId)}`;
}

function probeFnNamePy(layerId: string): string {
  return `probe_${layerId}`;
}

function unitFileContentTs(layerId: string, nextLayerId: string | undefined): string {
  const fn = probeFnNameTs(layerId);
  if (!nextLayerId) {
    return `/** SextantDrift constraint unit — architecture probe (not production code). */
export function ${fn}(): string {
  return '${layerId}-ok';
}
`;
  }
  const nextFn = probeFnNameTs(nextLayerId);
  return `/** SextantDrift constraint unit — architecture probe (not production code). */
import { ${nextFn} } from './${nextLayerId}.js';

export function ${fn}(): string {
  return ${nextFn}();
}
`;
}

function unitFileContentPy(layerId: string, nextLayerId: string | undefined): string {
  const fn = probeFnNamePy(layerId);
  if (!nextLayerId) {
    return `"""SextantDrift constraint unit — architecture probe (not production code)."""


def ${fn}() -> str:
    return "${layerId}-ok"
`;
  }
  const nextFn = probeFnNamePy(nextLayerId);
  return `"""SextantDrift constraint unit — architecture probe (not production code)."""

from .${nextLayerId} import ${nextFn}


def ${fn}() -> str:
    return ${nextFn}()
`;
}

/**
 * Detect scaffold language: Python-dominant when .py count > .ts/.tsx count
 * or when pyproject.toml / setup.py exists and no TypeScript sources under src.
 */
export function detectScaffoldLanguage(rootDir: string, sourceDirName: string): ScaffoldLanguage {
  const fullSrc = sourceDirName === '.' ? rootDir : path.resolve(rootDir, sourceDirName);
  let py = 0;
  let ts = 0;

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.sextant') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        if (entry.name.endsWith('.py')) py++;
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) ts++;
      }
    }
  }

  if (fs.existsSync(fullSrc)) walk(fullSrc);
  else walk(rootDir);

  if (py > ts) return 'py';

  const hasPyProject =
    fs.existsSync(path.join(rootDir, 'pyproject.toml')) ||
    fs.existsSync(path.join(rootDir, 'setup.py'));
  if (hasPyProject && ts === 0 && py > 0) return 'py';

  return 'ts';
}

/**
 * Writes one constraint unit per layer under `.sextant/units/`,
 * wired only along consecutive allowDependencies (downward).
 */
export function scaffoldConstraintUnits(
  rootDir: string,
  layers: ScaffoldLayer[],
  options: { overwrite?: boolean; language?: ScaffoldLanguage } = {}
): ScaffoldResult {
  const language = options.language ?? 'ts';
  const ext = language === 'py' ? 'py' : 'ts';
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const unitsAbs = path.resolve(rootDir, CONSTRAINT_UNITS_DIR);
  fs.mkdirSync(unitsAbs, { recursive: true });

  if (language === 'py') {
    const initPy = path.join(unitsAbs, '__init__.py');
    if (!fs.existsSync(initPy) || options.overwrite) {
      fs.writeFileSync(initPy, '"""SextantDrift constraint units package."""\n', 'utf-8');
    }
    const sextantInit = path.resolve(rootDir, '.sextant', '__init__.py');
    if (!fs.existsSync(sextantInit) || options.overwrite) {
      fs.mkdirSync(path.dirname(sextantInit), { recursive: true });
      fs.writeFileSync(sextantInit, '"""SextantDrift local package root."""\n', 'utf-8');
    }
  }

  const written: string[] = [];
  const skipped: string[] = [];
  const components: ScaffoldComponent[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const layer = sorted[i];
    const next = sorted[i + 1];
    const relPath = `${CONSTRAINT_UNITS_DIR}/${layer.id}.${ext}`;
    const absPath = path.resolve(rootDir, relPath);
    const content =
      language === 'py'
        ? unitFileContentPy(layer.id, next?.id)
        : unitFileContentTs(layer.id, next?.id);

    if (fs.existsSync(absPath) && !options.overwrite) {
      skipped.push(relPath);
    } else {
      fs.writeFileSync(absPath, content, 'utf-8');
      written.push(relPath);
    }

    const unitId = `Unit${pascalCase(layer.id)}`;
    components.push({
      id: unitId,
      name: `${unitId} Constraint Unit`,
      layerId: layer.id,
      paths: [relPath],
      technology: language === 'py' ? 'Python' : 'TypeScript',
      description: `Minimal architecture constraint unit for ${layer.id}`,
    });
  }

  return { written, skipped, components, language };
}

export function presentationUnitPath(language: ScaffoldLanguage = 'ts'): string {
  return language === 'py'
    ? `${CONSTRAINT_UNITS_DIR}/presentation.py`
    : `${CONSTRAINT_UNITS_DIR}/presentation.ts`;
}
