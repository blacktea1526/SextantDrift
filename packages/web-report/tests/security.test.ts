import { describe, it, expect } from 'vitest';
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
