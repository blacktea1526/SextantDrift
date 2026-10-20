import path from 'node:path';
import { checkFileDrift, CheckFileResult } from '@sextant/core';

export interface CheckFileArgs {
  filePath: string;
  fileContent: string;
  rootDir?: string;
  specPath?: string;
}

export function runCheckFile(args: CheckFileArgs): CheckFileResult {
  const rootDir = path.resolve(args.rootDir || process.cwd());

  return checkFileDrift({
    rootDir,
    filePath: args.filePath,
    fileContent: args.fileContent,
    specPath: args.specPath,
  });
}
