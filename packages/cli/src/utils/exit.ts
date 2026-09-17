export const EXIT_CODE_SUCCESS = 0;
export const EXIT_CODE_DRIFT_DETECTED = 1;
export const EXIT_CODE_FATAL_ERROR = 2;

export function exitWithCode(code: number): never {
  process.exit(code);
}
