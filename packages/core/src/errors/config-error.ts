export class ConfigSyntaxError extends Error {
  public readonly line?: number;
  public readonly column?: number;
  public readonly snippet?: string;

  constructor(message: string, options?: { line?: number; column?: number; snippet?: string }) {
    super(message);
    this.name = 'ConfigSyntaxError';
    this.line = options?.line;
    this.column = options?.column;
    this.snippet = options?.snippet;
  }
}

export class ConfigValidationError extends Error {
  public readonly field?: string;

  constructor(message: string, options?: { field?: string }) {
    super(message);
    this.name = 'ConfigValidationError';
    this.field = options?.field;
  }
}
