import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { runCheck } from '../src/commands/check.js';
import { EXIT_CODE_SUCCESS, EXIT_CODE_DRIFT_DETECTED } from '../src/utils/exit.js';

describe('CLI check Command (Task 4.2)', () => {
  const cleanAppPath = path.resolve(__dirname, '../../core/tests/fixtures/clean-layered-app');
  const driftedAppPath = path.resolve(__dirname, '../../core/tests/fixtures/drifted-bypass-app');

  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should return Exit Code 0 on clean-layered-app', async () => {
    const code = await runCheck(cleanAppPath);
    expect(code).toBe(EXIT_CODE_SUCCESS);

    const logged = consoleLogSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(logged).toContain('✔ Clean');
    expect(logged).toContain('0 architectural drifts detected');
  });

  it('should return Exit Code 1 on drifted-bypass-app', async () => {
    const code = await runCheck(driftedAppPath);
    expect(code).toBe(EXIT_CODE_DRIFT_DETECTED);

    const logged = consoleLogSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(logged).toContain('architectural drift');
    expect(logged).toContain('CRITICAL_BYPASS');
  });

  it('should output machine-readable JSON when --json is passed', async () => {
    const code = await runCheck(cleanAppPath, { json: true });
    expect(code).toBe(EXIT_CODE_SUCCESS);

    const logged = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(logged);
    expect(parsed.passed).toBe(true);
    expect(parsed.summary.totalFiles).toBeGreaterThanOrEqual(3);
    expect(parsed.violations).toHaveLength(0);
  });

  it('should detect and report state machine deadlocks in ARCHITECTURE.md', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-state-test-'));

    try {
      // Minimal valid architecture with a flawed state machine diagram
      const mdContent = `
# System Spec

\`\`\`mermaid
flowchart TD
    subgraph Core ["Core Layer"]
        MainComp["Main"]
    end
\`\`\`

## Workflow State Diagram
\`\`\`mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> DeadlockedState: hang
\`\`\`
`;
      fs.writeFileSync(path.join(tempDir, 'ARCHITECTURE.md'), mdContent, 'utf-8');
      fs.mkdirSync(path.join(tempDir, 'src/core'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'src/core/main.ts'), 'export const x = 1;', 'utf-8');

      const code = await runCheck(tempDir);
      expect(code).toBe(EXIT_CODE_DRIFT_DETECTED);

      const logged = consoleLogSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(logged).toContain('STATE_DEADLOCK');
      expect(logged).toContain('STATE_MISSING_FALLBACK');
      expect(logged).toContain('DeadlockedState');
      expect(logged).toContain('2 state');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

