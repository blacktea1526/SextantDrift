import path from 'node:path';
import { resolveTargetArchitecture, reviewScope } from '@sextant/core';
import { EXIT_CODE_FATAL_ERROR, EXIT_CODE_SUCCESS } from '../utils/exit.js';

export interface RequirementsOptions {
  config?: string;
  stdout?: (line: string) => void;
}

/**
 * Prints the declared review scope for one business entity.
 * This does not analyze source code and does not change check results.
 */
export async function runRequirements(
  entityId: string,
  dir: string = '.',
  options: RequirementsOptions = {},
): Promise<number> {
  const write = options.stdout ?? ((line: string) => console.log(line));
  const rootDir = path.resolve(process.cwd(), dir);
  try {
    const architecture = resolveTargetArchitecture(rootDir, options.config);
    if (!architecture.businessRequirements) {
      write('businessRequirements is not configured');
      return EXIT_CODE_FATAL_ERROR;
    }
    const scope = reviewScope(architecture.businessRequirements, entityId);
    write(`待检查 ${scope.entityId}`);
    write('这是已声明关系的复核范围，不是代码影响证明。');
    for (const item of scope.items) {
      if (item.anchor === 'missing') {
        write(`${item.id} 复核范围 ${item.relation} 锚点缺失`);
      } else if (item.source) {
        write(`${item.id} 复核范围 ${item.relation} 锚点已声明 ${item.source}`);
      } else {
        write(`${item.id} 复核范围 ${item.relation}`);
      }
    }
    return EXIT_CODE_SUCCESS;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    write(message);
    return EXIT_CODE_FATAL_ERROR;
  }
}
