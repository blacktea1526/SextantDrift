import { describe, it, expect } from 'vitest';
import * as cli from '../src/index';

describe('@sextant/cli entrypoint', () => {
  it('should export core functions and types from @sextant/core', () => {
    expect(cli.analyzeModuleDrift).toBeDefined();
    expect(typeof cli.analyzeModuleDrift).toBe('function');
    expect(cli.generateActualMermaid).toBeDefined();
    expect(typeof cli.generateActualMermaid).toBe('function');
  });

  it('should export graph utilities from core', () => {
    expect(cli.detectCycles).toBeDefined();
    expect(typeof cli.detectCycles).toBe('function');
    expect(cli.DirectedGraph).toBeDefined();
  });
});
