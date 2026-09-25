import { describe, it, expect } from 'vitest';
import * as cli from '../src/index';

describe('@sextant/cli entrypoint', () => {
  it('should export core functions and types from @sextant/core', () => {
    expect(cli.analyzeModuleDrift).toBeDefined();
    expect(typeof cli.analyzeModuleDrift).toBe('function');
    expect(cli.generateActualMermaid).toBeDefined();
    expect(typeof cli.generateActualMermaid).toBe('function');
  });

  it('should export CLI commands and formatters', () => {
    expect(cli.runCheck).toBeDefined();
    expect(typeof cli.runCheck).toBe('function');
    expect(cli.runBaseline).toBeDefined();
    expect(typeof cli.runBaseline).toBe('function');
    expect(cli.runInit).toBeDefined();
    expect(typeof cli.runInit).toBe('function');
    expect(cli.runReport).toBeDefined();
    expect(typeof cli.runReport).toBe('function');
    expect(cli.formatTerminalReport).toBeDefined();
    expect(typeof cli.formatTerminalReport).toBe('function');
  });

  it('should export CLI_VERSION matching package version', () => {
    expect(cli.CLI_VERSION).toBeDefined();
    expect(cli.CLI_VERSION).toBe('2.0.2');
  });
});
