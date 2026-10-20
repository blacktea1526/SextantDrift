export interface GenerateReporterOptions {
  runId: string;
  rootDir: string;
  markerPath: string;
}

export function generateReporterSource(options: GenerateReporterOptions): string {
  const { runId, rootDir, markerPath } = options;

  return `import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const runId = ${JSON.stringify(runId)};
const rootDir = ${JSON.stringify(rootDir)};
const markerPath = ${JSON.stringify(markerPath)};

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

export default class CustomReporter {
  onFinished(files = [], errors = []) {
    const inventory = [];

    function collectTasks(task) {
      if (task.type === 'suite') {
        for (const sub of (task.tasks || [])) {
          collectTasks(sub);
        }
      } else {
        const absFilePath = task.file?.filepath || task.file?.name || '';
        const relFilePath = normalizePosix(path.relative(rootDir, absFilePath));
        const suiteNames = extractSuites(task);
        inventory.push({
          testFile: relFilePath,
          taskName: task.name,
          fullNameArrow: [...suiteNames, task.name].join(' > '),
          fullNameSpace: [...suiteNames, task.name].join(' '),
          mode: task.mode,
          state: task.result?.state,
        });
      }
    }

    for (const file of files) {
      if (file.result?.errors && file.result.errors.length > 0) {
        for (const err of file.result.errors) {
          errors.push(err);
        }
      }
      for (const task of (file.tasks || [])) {
        collectTasks(task);
      }
    }

    const serializedErrors = (errors || []).map((err) => {
      if (err instanceof Error) {
        return err.message || err.stack || String(err);
      }
      if (typeof err === 'object' && err !== null) {
        return err.message || JSON.stringify(err);
      }
      return String(err);
    });

    const endMarker = {
      runId,
      inventory,
      errors: serializedErrors,
      finishedAt: Date.now(),
    };

    const tempMarker = \`\${markerPath}.tmp.\${crypto.randomUUID()}\`;
    fs.writeFileSync(tempMarker, JSON.stringify(endMarker, null, 2), 'utf-8');
    fs.renameSync(tempMarker, markerPath);
  }
}
`;
}
