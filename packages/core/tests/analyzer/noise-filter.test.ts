import { describe, it, expect } from 'vitest';
import { matchesPatterns, findComponentForFile, isNoiseFile } from '../../src/analyzer/noise-filter.js';
import { Component } from '../../src/types/architecture.js';

describe('C4 Noise Filter', () => {
  const components: Component[] = [
    {
      id: 'Controller',
      name: 'Controllers',
      layerId: 'Presentation',
      paths: ['src/controllers/**'],
    },
    {
      id: 'Service',
      name: 'Services',
      layerId: 'Domain',
      paths: ['src/services/**'],
    },
  ];

  it('should match glob patterns accurately', () => {
    expect(matchesPatterns('src/controllers/user.controller.ts', ['src/controllers/**'])).toBe(true);
    expect(matchesPatterns('src/services/auth/token.ts', ['src/services/**'])).toBe(true);
    expect(matchesPatterns('src/utils/format.ts', ['src/controllers/**', 'src/services/**'])).toBe(false);
  });

  it('should identify component owning the file', () => {
    const comp = findComponentForFile('src/controllers/user.controller.ts', components);
    expect(comp?.id).toBe('Controller');
  });

  it('should classify unassigned utils as noise files', () => {
    expect(isNoiseFile('src/utils/format.ts', components)).toBe(true);
    expect(isNoiseFile('src/common/logger.ts', components)).toBe(true);
    expect(isNoiseFile('src/services/user.service.ts', components)).toBe(false);
  });
});
