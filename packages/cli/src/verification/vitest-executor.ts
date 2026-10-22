import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { AcceptanceConfig, CheckEvidence } from '@sextant/core';

export interface ExecuteAcceptanceOptions {
  timeoutMs?: number;
}

export interface AcceptanceExecutionResult {
  runId: string;
  runDir: string;
  complete: boolean;
  durationMs: number;
  checks: CheckEvidence[];
  errors: string[];
}

interface VitestAssertionResult {
  ancestorTitles: string[];
  fullName: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
  duration?: number;
  failureMessages?: string[];
  location?: { line?: number; column?: number };
}

interface VitestFileResult {
  name: string;
  status: 'passed' | 'failed';
  message?: string;
  assertionResults: VitestAssertionResult[];
}

interface VitestJsonReport {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numPendingTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  startTime: number;
  success: boolean;
  testResults: VitestFileResult[];
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function resolveVitest(rootDir: string): { vitestBin: string; version: string; vitestDir: string } {
  let pkgPath: string | undefined;

  // 1. Project-local node_modules
  const localPkg = path.join(rootDir, 'node_modules', 'vitest', 'package.json');
  if (fs.existsSync(localPkg)) {
    pkgPath = localPkg;
  }

  if (!pkgPath) {
    throw new Error(`Vitest not found in ${rootDir}/node_modules. Local Vitest v2.1.x is required.`);
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkgJson.version as string;
  if (!version || !/^2\.1\./.test(version)) {
    throw new Error(`Unsupported Vitest version ${version}: must be 2.1.x`);
  }

  const vitestDir = path.dirname(pkgPath);
  const vitestBin = path.join(vitestDir, 'vitest.mjs');
  if (!fs.existsSync(vitestBin)) {
    throw new Error(`Vitest binary entrypoint not found at ${vitestBin}`);
  }

  return { vitestBin, version, vitestDir };
}

function ensureVitestAvailable(rootDir: string, vitestDir: string, runDir: string): void {
  try {
    const runNodeModules = path.join(runDir, 'node_modules');
    if (!fs.existsSync(runNodeModules)) {
      fs.mkdirSync(runNodeModules, { recursive: true });
    }
    const runVitest = path.join(runNodeModules, 'vitest');
    if (!fs.existsSync(runVitest)) {
      fs.symlinkSync(vitestDir, runVitest, 'dir');
    }
  } catch {
    // Ignore symlink errors
  }

  try {
    const rootNodeModules = path.join(rootDir, 'node_modules');
    if (!fs.existsSync(rootNodeModules)) {
      fs.mkdirSync(rootNodeModules, { recursive: true });
    }
    const rootVitest = path.join(rootNodeModules, 'vitest');
    if (!fs.existsSync(rootVitest)) {
      fs.symlinkSync(vitestDir, rootVitest, 'dir');
    }
  } catch {
    // Ignore symlink errors
  }
}

export async function executeAcceptanceTests(
  rootDir: string,
  acceptance: AcceptanceConfig,
  options: ExecuteAcceptanceOptions = {},
): Promise<AcceptanceExecutionResult> {
  const runId = randomUUID();
  const runDir = path.join(rootDir, '.sextant', 'verification', 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });

  const uniqueTestFiles = Array.from(
    new Set((acceptance.checks || []).map((check) => check.testFile.trim()))
  ).filter(Boolean);

  if ((acceptance.checks || []).length === 0 || uniqueTestFiles.length === 0) {
    const emptyResult: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs: 0,
      checks: [],
      errors: [],
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(emptyResult, null, 2), 'utf8');
    return emptyResult;
  }

  const seenCheckIdsValidation = new Set<string>();
  const seenIdentitiesValidation = new Set<string>();
  const duplicateErrors: string[] = [];

  for (const check of acceptance.checks || []) {
    if (seenCheckIdsValidation.has(check.id)) {
      duplicateErrors.push(`Duplicate check id "${check.id}".`);
    }
    seenCheckIdsValidation.add(check.id);

    const identity = `${check.testFile}:::${check.testName}`;
    if (seenIdentitiesValidation.has(identity)) {
      duplicateErrors.push(`Duplicate test identity "${identity}" in check "${check.id}".`);
    }
    seenIdentitiesValidation.add(identity);
  }

  if (duplicateErrors.length > 0) {
    const dupResult: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs: 0,
      checks: [],
      errors: duplicateErrors,
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(dupResult, null, 2), 'utf8');
    return dupResult;
  }

  let vitestInfo: { vitestBin: string; version: string; vitestDir: string };
  try {
    vitestInfo = resolveVitest(rootDir);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failResult: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs: 0,
      checks: [],
      errors: [errorMsg],
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(failResult, null, 2), 'utf8');
    return failResult;
  }

  ensureVitestAvailable(rootDir, vitestInfo.vitestDir, runDir);

  const reporterJsonPath = path.join(runDir, 'reporter.json');
  const endMarkerPath = path.join(runDir, 'end-marker.json');
  const configPath = path.join(runDir, 'vitest.config.mjs');

  const configContent = `
import fs from 'node:fs';
import path from 'node:path';

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

class SextantReporter {
  onFinished(files = [], errors = []) {
    try {
      const inventory = [];

      function collectTasks(task) {
        if (task.type === 'suite') {
          for (const sub of (task.tasks || [])) {
            collectTasks(sub);
          }
        } else {
          const absFilePath = task.file?.filepath || task.file?.name || '';
          const relFilePath = normalizePosix(path.relative(${JSON.stringify(rootDir)}, absFilePath));
          const suiteNames = extractSuites(task);
          inventory.push({
            testFile: relFilePath,
            taskName: task.name,
            fullNameArrow: [...suiteNames, task.name].join(' > '),
            fullNameSpace: [...suiteNames, task.name].join(' '),
            mode: task.mode,
            state: task.result?.state,
            retry: task.retry || 0,
            repeats: task.repeats || 0,
            fails: Boolean(task.fails),
          });
        }
      }

      for (const file of files) {
        for (const task of (file.tasks || [])) {
          collectTasks(task);
        }
      }

      const endMarker = {
        runId: ${JSON.stringify(runId)},
        inventory,
        errors: (errors || []).map(e => e instanceof Error ? (e.message || e.stack || String(e)) : String(e)),
        finishedAt: Date.now(),
      };
      fs.writeFileSync(${JSON.stringify(endMarkerPath)}, JSON.stringify(endMarker, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }
}

export default {
  test: {
    root: ${JSON.stringify(rootDir)},
    include: ${JSON.stringify(uniqueTestFiles)},
    pool: 'forks',
    watch: false,
    retry: 0,
    reporters: [
      'json',
      new SextantReporter(),
    ],
    outputFile: ${JSON.stringify(reporterJsonPath)},
  },
};
`;
  fs.writeFileSync(configPath, configContent, 'utf8');

  const args = [vitestInfo.vitestBin, 'run', ...uniqueTestFiles, '--config', configPath];

  const startTime = Date.now();
  let timedOut = false;
  let stdout = '';
  let stderr = '';
  const MAX_LOG_BYTES = 64 * 1024;

  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      CI: '1',
      NO_COLOR: '1',
    },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    if (stdout.length < MAX_LOG_BYTES) {
      stdout += chunk.toString();
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    if (stderr.length < MAX_LOG_BYTES) {
      stderr += chunk.toString();
    }
  });

  const timeoutMs = options.timeoutMs ?? 10000;
  let forceKillTimer: NodeJS.Timeout | undefined;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
    forceKillTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, 2000);
  }, timeoutMs);

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('close', (code) => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve(code);
    });
    child.on('error', () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve(-1);
    });
  });

  const durationMs = Date.now() - startTime;
  const errors: string[] = [];

  if (timedOut) {
    errors.push(`Acceptance test execution timed out after ${timeoutMs}ms`);
    const result: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs,
      checks: [],
      errors,
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(result, null, 2), 'utf8');
    return result;
  }

  let endMarkerData: { inventory?: Array<{ testFile: string; taskName: string; fullNameArrow: string; fullNameSpace: string; mode?: string; state?: string; retry?: number; repeats?: number; fails?: boolean }>; errors?: string[] } | null = null;
  if (fs.existsSync(endMarkerPath)) {
    try {
      endMarkerData = JSON.parse(fs.readFileSync(endMarkerPath, 'utf8'));
    } catch {
      // ignore
    }
  }

  if (!endMarkerData) {
    const tailErr = stderr.trim() ? `: ${stderr.slice(-500).trim()}` : '';
    errors.push(`Acceptance test execution did not complete normally (exit code ${exitCode})${tailErr}`);
    const result: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs,
      checks: [],
      errors,
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(result, null, 2), 'utf8');
    return result;
  }

  if (endMarkerData.errors && endMarkerData.errors.length > 0) {
    errors.push(...endMarkerData.errors);
  }

  if (!fs.existsSync(reporterJsonPath)) {
    errors.push('Vitest reporter output file is missing');
    const result: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs,
      checks: [],
      errors,
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(result, null, 2), 'utf8');
    return result;
  }

  let report: VitestJsonReport;
  try {
    report = JSON.parse(fs.readFileSync(reporterJsonPath, 'utf8'));
  } catch (err) {
    errors.push(`Vitest reporter output is malformed: ${err instanceof Error ? err.message : String(err)}`);
    const result: AcceptanceExecutionResult = {
      runId,
      runDir,
      complete: false,
      durationMs,
      checks: [],
      errors,
    };
    fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(result, null, 2), 'utf8');
    return result;
  }

  // Group checks by testFile
  const checksByFile = new Map<string, typeof acceptance.checks>();
  for (const check of acceptance.checks) {
    const list = checksByFile.get(check.testFile) || [];
    list.push(check);
    checksByFile.set(check.testFile, list);
  }

  // Index file results by project-relative POSIX path
  const fileResultsByRelPath = new Map<string, VitestFileResult>();
  for (const fileResult of report.testResults || []) {
    const relPath = path.isAbsolute(fileResult.name)
      ? toPosixPath(path.relative(rootDir, fileResult.name))
      : toPosixPath(fileResult.name);
    fileResultsByRelPath.set(relPath, fileResult);
  }

  const inventory = endMarkerData.inventory || [];
  const checksEvidenceList: CheckEvidence[] = [];
  const seenCheckIds = new Set<string>();

  for (const [testFile, fileChecks] of checksByFile.entries()) {
    const fileResult = fileResultsByRelPath.get(testFile);
    if (!fileResult) {
      // Test file was not reported; evaluator will mark UNVERIFIED
      continue;
    }

    // Check for suite-level failure (e.g. syntax/compilation error, hook error before any test)
    if (fileResult.status === 'failed' && (fileResult.assertionResults.length === 0 || fileResult.message)) {
      const suiteMsg = fileResult.message || 'Test suite failed to run';
      errors.push(`Suite error in ${testFile}: ${suiteMsg}`);
      for (const check of fileChecks) {
        if (!seenCheckIds.has(check.id)) {
          seenCheckIds.add(check.id);
          checksEvidenceList.push({
            checkId: check.id,
            scenarioId: check.scenarioId,
            testFile: check.testFile,
            testName: check.testName,
            status: 'ERROR',
            message: suiteMsg,
          });
        }
      }
      continue;
    }

    // Deduplicate attempts: record only the final attempt per test name
    const finalAttemptByName = new Map<string, VitestAssertionResult>();
    for (const assertion of fileResult.assertionResults) {
      finalAttemptByName.set(assertion.fullName, assertion);
    }

    for (const check of fileChecks) {
      if (seenCheckIds.has(check.id)) {
        errors.push(`Duplicate evidence for acceptance check "${check.id}".`);
        continue;
      }
      seenCheckIds.add(check.id);

      // Check reporter inventory for task options like retry/repeats/fails or skip
      const inv = inventory.find(
        (item) =>
          item.testFile === check.testFile &&
          (item.fullNameArrow === check.testName ||
            item.fullNameSpace === check.testName ||
            item.taskName === check.testName),
      );

      if (inv && ((inv.retry && inv.retry > 0) || (inv.repeats && inv.repeats > 0) || inv.fails)) {
        const msg = 'Test-level retry, repeats, or fails modes are not permitted in acceptance verification.';
        errors.push(`Test-level retry/repeats/fails not permitted in "${check.id}": ${msg}`);
        checksEvidenceList.push({
          checkId: check.id,
          scenarioId: check.scenarioId,
          testFile: check.testFile,
          testName: check.testName,
          status: 'ERROR',
          message: msg,
        });
        continue;
      }

      if (inv && (inv.mode === 'skip' || inv.state === 'skip')) {
        checksEvidenceList.push({
          checkId: check.id,
          scenarioId: check.scenarioId,
          testFile: check.testFile,
          testName: check.testName,
          status: 'SKIP',
        });
        continue;
      }

      const assertion = finalAttemptByName.get(check.testName);
      if (!assertion) {
        // Specific test was not run in this file; evaluator will handle absence of evidence
        continue;
      }

      let status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
      let message: string | undefined;
      let location: { file: string; line: number } | undefined;

      if (assertion.status === 'passed') {
        status = 'PASS';
      } else if (
        assertion.status === 'skipped' ||
        assertion.status === 'pending' ||
        assertion.status === 'todo'
      ) {
        status = 'SKIP';
      } else if (assertion.status === 'failed') {
        const rawMessages = (assertion.failureMessages || []).join('\n');
        const cleanMessage = rawMessages.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
        message = cleanMessage || 'Assertion failed';

        const isAssertionFailure = (assertion.failureMessages || []).some((m) =>
          m.includes('AssertionError'),
        );
        if (isAssertionFailure) {
          status = 'FAIL';
        } else {
          status = 'ERROR';
          errors.push(cleanMessage);
        }

        // Extract location from failure stack trace if present
        const match = rawMessages.match(/(?:at\s+.*?\()?([^\s()]+):(\d+):(\d+)\)?/);
        if (match) {
          const rawFile = match[1];
          const line = parseInt(match[2], 10);
          if (Number.isInteger(line) && line > 0) {
            const locFile = path.isAbsolute(rawFile)
              ? toPosixPath(path.relative(rootDir, rawFile))
              : toPosixPath(rawFile);
            if (locFile && !locFile.startsWith('..')) {
              location = { file: locFile, line };
            }
          }
        }
      } else {
        status = 'ERROR';
        message = `Unknown assertion status: ${assertion.status}`;
        errors.push(message);
      }

      const evidence: CheckEvidence = {
        checkId: check.id,
        scenarioId: check.scenarioId,
        testFile: check.testFile,
        testName: check.testName,
        status,
        ...(message ? { message } : {}),
        ...(location ? { location } : {}),
      };

      checksEvidenceList.push(evidence);
    }
  }

  const finalResult: AcceptanceExecutionResult = {
    runId,
    runDir,
    complete: errors.length === 0,
    durationMs,
    checks: checksEvidenceList,
    errors,
  };

  fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(finalResult, null, 2), 'utf8');
  return finalResult;
}
