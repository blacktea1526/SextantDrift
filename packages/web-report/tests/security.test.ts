import { describe, it, expect } from 'vitest';
import type { DriftReport } from '@sextant/core';
import { generateHtmlReport } from '../src/index.js';
import { getReportScript } from '../src/scripts/report.js.js';
import { escapeHtml, safeJsonStringify } from '../src/utils/security.js';

describe('Web Report Security Utilities (security.ts)', () => {
  describe('escapeHtml', () => {
    it('should escape dangerous HTML characters', () => {
      const raw = '<script>alert("xss & \'injection\'")</script>';
      const escaped = escapeHtml(raw);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss &amp; &#039;injection&#039;&quot;)&lt;/script&gt;');
    });

    it('should handle empty, null or undefined input', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null as unknown as string)).toBe('');
      expect(escapeHtml(undefined as unknown as string)).toBe('');
    });
  });

  describe('safeJsonStringify', () => {
    it('should escape script closing tags preventing breakout from <script> tags', () => {
      const payload = {
        message: 'Broken code: </script><script>alert("XSS")</script>',
        snippet: 'const x = "</script>";',
      };
      const serialized = safeJsonStringify(payload);

      // Must not contain raw </script> or <script>
      expect(serialized).not.toContain('</script>');
      expect(serialized).not.toContain('<script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
      expect(serialized).toContain('\\u003cscript\\u003e');

      // Must be safely reconstructible via JSON.parse
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(payload);
    });

    it('should escape ampersands and angle brackets in nested structures', () => {
      const complexData = {
        nested: {
          tag: '<div id="test">',
          query: 'a=1&b=2',
        },
        list: ['<b>bold</b>', '&&'],
      };
      const serialized = safeJsonStringify(complexData);
      expect(serialized).not.toContain('<');
      expect(serialized).not.toContain('>');
      expect(serialized).not.toContain('&');

      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(complexData);
    });
  });
});

describe('Inspector drawer XSS hardening (report.js)', () => {
  const xssId = '<script>alert("xss")</script>';
  const xssMsg = '"><img src=x onerror=alert(1)>';

  it('embeds a runtime escapeHtml helper used by inspector innerHTML construction', () => {
    const script = getReportScript({
      violationsJson: '[]',
      graphDataJson: '{}',
      contractCompIdsJson: '[]',
      dependencyMapJson: '{}',
      i18nJson: '{}',
      lang: 'en',
      passed: true,
    });

    expect(script).toMatch(/function escapeHtml\s*\(/);
    expect(script).toContain(".replace(/&/g, '&amp;')");
    expect(script).toContain(".replace(/</g, '&lt;')");

    // Inspector must escape edge/violation fields before innerHTML interpolation
    expect(script).toContain('escapeHtml(e.from)');
    expect(script).toContain('escapeHtml(e.to)');
    expect(script).toContain('escapeHtml(e.status)');
    expect(script).toContain('escapeHtml(v.type)');
    expect(script).toContain('escapeHtml(v.sourceFile)');
    expect(script).toContain('escapeHtml(v.line)');
    expect(script).toContain('escapeHtml(v.message)');
  });

  it('escapes malicious component ids and messages in generated report HTML/JSON paths', () => {
    const report: DriftReport = {
      passed: false,
      exitCode: 1,
      durationMs: 1,
      targetArchitecture: {
        name: 'XSS Probe',
        layers: [{ id: 'UI', name: 'UI', order: 1 }],
        components: [
          { id: xssId, name: xssId, layerId: 'UI', paths: ['src/**'] },
        ],
        allowDependencies: [],
      },
      graphData: {
        systemName: 'XSS Probe',
        containers: [
          { id: 'UI', name: 'UI', order: 1, status: 'drift', componentIds: [xssId] },
        ],
        nodes: [
          {
            id: xssId,
            name: xssId,
            layerId: 'UI',
            paths: ['src/**'],
            fileCount: 1,
            status: 'drift',
            violationCount: 1,
          },
        ],
        edges: [
          {
            id: `${xssId}->${xssId}`,
            from: xssId,
            to: xssId,
            status: 'drift',
            type: 'bypass',
            violations: ['VX'],
          },
        ],
        targetEdges: [],
        actualEdges: [],
      },
      violations: [
        {
          id: 'VX',
          type: 'CRITICAL_BYPASS',
          severity: 'critical',
          message: xssMsg,
          sourceFile: 'src/<script>evil.ts',
          line: 1,
          column: 1,
          sourceComponent: xssId,
          targetComponent: xssId,
        },
      ],
      summary: {
        totalFiles: 1,
        totalDependencies: 1,
        totalViolations: 1,
        exemptedViolations: 0,
        newViolations: 1,
        bypassCount: 1,
        inversionCount: 0,
        cycleCount: 0,
        forbiddenImportCount: 0,
        invariantViolationCount: 0,
      },
    };

    const html = generateHtmlReport(report, { lang: 'en' });

    // Embedded graph/violation JSON uses safeJsonStringify (no raw <script> breakout)
    expect(html).toContain('\\u003cscript\\u003e');
    expect(html).toContain('\\u003c/script\\u003e');

    // SSR violation cards must HTML-escape message / file (inspector sibling path)
    expect(html).toContain(escapeHtml(xssMsg));
    expect(html).toContain(escapeHtml('src/<script>evil.ts'));
    expect(html).not.toContain(`>${xssMsg}<`);
    expect(html).not.toContain(`card-message">${xssMsg}`);

    // Client inspector path: escape helper present and wired in emitted script
    expect(html).toMatch(/function escapeHtml\s*\(/);
    expect(html).toContain('escapeHtml(v.message)');
    expect(html).toContain('escapeHtml(e.from)');
    expect(html).toContain('escapeHtml(e.to)');
    expect(html).toContain('escapeHtml(v.type)');
    expect(html).toContain('escapeHtml(v.sourceFile)');
  });
});
