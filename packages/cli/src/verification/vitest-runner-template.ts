import { pathToFileURL } from 'node:url';
import type { AcceptanceCheck } from '@sextant/core';

export interface GenerateRunnerOptions {
  runId: string;
  rootDir: string;
  evidenceDir: string;
  runnersPath: string;
  checks: AcceptanceCheck[];
}

export function generateRunnerSource(options: GenerateRunnerOptions): string {
  const { runId, rootDir, evidenceDir, runnersPath, checks } = options;
  const runnersUrl = pathToFileURL(runnersPath).href;

  return `import { VitestTestRunner } from ${JSON.stringify(runnersUrl)};
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const runId = ${JSON.stringify(runId)};
const rootDir = ${JSON.stringify(rootDir)};
const evidenceDir = ${JSON.stringify(evidenceDir)};
const configuredChecks = ${JSON.stringify(checks)};

function normalizePosix(p) {
  return p.split(path.sep).join('/');
}

function extractSuites(task) {
  const names = [];
  let curr = task;
  while (curr?.suite) {
    curr = curr.suite;
    if (curr?.name) names.unshift(curr.name);
  }
  return names;
}

export default class CustomRunner extends VitestTestRunner {
  async onAfterRunTask(test) {
    await super.onAfterRunTask(test);

    const absFilePath = test.file?.filepath || test.file?.name || '';
    const relFilePath = normalizePosix(path.relative(rootDir, absFilePath));
    const suiteNames = extractSuites(test);
    const fullNameArrow = [...suiteNames, test.name].join(' > ');
    const fullNameSpace = [...suiteNames, test.name].join(' ');
    const testOnlyName = test.name;

    const matched = [];
    for (const chk of configuredChecks) {
      if (chk.testFile === relFilePath) {
        if (chk.testName === fullNameArrow || chk.testName === fullNameSpace || chk.testName === testOnlyName) {
          matched.push(chk);
        }
      }
    }

    if (matched.length === 0) {
      return;
    }

    for (const chk of matched) {
      let location = undefined;
      if (test.location && typeof test.location.line === 'number' && test.location.line > 0) {
        location = { file: chk.testFile, line: test.location.line };
      } else {
        const rawErrors = test.result?.errors || [];
        for (const e of rawErrors) {
          if (e?.stack) {
            const lines = e.stack.split('\\n');
            const normalizedFile = chk.testFile.split('\\\\').join('/');
            for (const l of lines) {
              const normL = l.split('\\\\').join('/');
              const idx = normL.indexOf(normalizedFile);
              if (idx !== -1) {
                const rest = normL.slice(idx + normalizedFile.length);
                const m = rest.match(/^:(\\d+)(?::\\d+)?/);
                if (m) {
                  const num = parseInt(m[1], 10);
                  if (Number.isInteger(num) && num > 0) {
                    location = { file: chk.testFile, line: num };
                    break;
                  }
                }
              }
            }
          }
          if (location) break;
        }
      }

      const errors = (test.result?.errors || []).map((e) => ({
        name: e?.name || (e?.constructor ? e.constructor.name : 'Error'),
        message: e?.message || String(e),
        stack: e?.stack || '',
        code: e?.code,
      }));

      const artifact = {
        runId,
        checkId: chk.id,
        scenarioId: chk.scenarioId,
        testFile: chk.testFile,
        testName: chk.testName,
        state: test.result?.state || 'unknown',
        mode: test.mode,
        retry: test.retry || 0,
        repeats: test.repeats || 0,
        fails: Boolean(test.fails),
        retryCount: test.result?.retryCount || 0,
        repeatCount: test.result?.repeatCount || 0,
        errors,
        location,
        duration: test.result?.duration,
        timestamp: Date.now(),
      };

      const uniqueId = crypto.randomUUID();
      const tmpFile = path.join(evidenceDir, \`\${chk.id}__\${uniqueId}.tmp\`);
      const finalFile = path.join(evidenceDir, \`\${chk.id}__\${uniqueId}.json\`);
      fs.writeFileSync(tmpFile, JSON.stringify(artifact, null, 2), 'utf-8');
      fs.renameSync(tmpFile, finalFile);
    }
  }
}
`;
}
