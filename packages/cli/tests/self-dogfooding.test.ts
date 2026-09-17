import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runCheck } from '../src/commands/check.js';
import { EXIT_CODE_SUCCESS } from '../src/utils/exit.js';

describe('SextantDrift Self-Dogfooding Verification (项目自身自举架构核验)', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('should pass architectural drift verification on SextantDrift itself with 0 drifts', async () => {
    const exitCode = await runCheck(rootDir);
    expect(exitCode).toBe(EXIT_CODE_SUCCESS);
  });
});
