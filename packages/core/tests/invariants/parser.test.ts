import { describe, it, expect } from 'vitest';
import {
  parseInvariantRules,
  parseInvariantsYaml,
  extractInvariantsFromMarkdown,
} from '../../src/invariants/parser.js';
import { ConfigValidationError, ConfigSyntaxError } from '../../src/errors/config-error.js';

describe('Invariants Parser & Schema Validation', () => {
  describe('parseInvariantRules', () => {
    it('should parse valid invariant rules with array patterns', () => {
      const input = [
        {
          id: 'rule-must-precede',
          severity: 'critical',
          desc: 'Save before sending message',
          pattern: {
            scope: 'src/services/**',
            target: ['externalClient.send'],
            must_precede: ['db.save', 'tx.commit'],
          },
        },
        {
          id: 'rule-forbid-import',
          severity: 'warning',
          desc: 'Do not import Prisma in UI',
          pattern: {
            in_path: 'src/ui/**',
            forbid_import: ['@prisma/client'],
          },
        },
        {
          id: 'rule-require-config',
          severity: 'info',
          desc: 'HTTP calls must have timeout',
          pattern: {
            target: ['fetch', 'axios.get'],
            require_config: ['timeout'],
          },
        },
      ];

      const rules = parseInvariantRules(input);
      expect(rules).toHaveLength(3);
      expect(rules[0].id).toBe('rule-must-precede');
      expect(rules[0].severity).toBe('critical');
      expect(rules[0].pattern.must_precede).toEqual(['db.save', 'tx.commit']);
      expect(rules[0].pattern.target).toEqual(['externalClient.send']);
      expect(rules[0].pattern.scope).toBe('src/services/**');

      expect(rules[1].id).toBe('rule-forbid-import');
      expect(rules[1].severity).toBe('warning');
      expect(rules[1].pattern.forbid_import).toEqual(['@prisma/client']);
      expect(rules[1].pattern.in_path).toBe('src/ui/**');

      expect(rules[2].id).toBe('rule-require-config');
      expect(rules[2].severity).toBe('info');
      expect(rules[2].pattern.require_config).toEqual(['timeout']);
    });

    it('should normalize single string values to arrays in pattern', () => {
      const input = [
        {
          id: 'rule-single-string',
          severity: 'critical',
          desc: 'Single string normalization',
          pattern: {
            target: 'client.call',
            must_precede: 'db.save',
            forbid_import: 'bad-lib',
            require_config: 'timeout',
          },
        },
      ];

      const rules = parseInvariantRules(input);
      expect(rules[0].pattern.target).toEqual(['client.call']);
      expect(rules[0].pattern.must_precede).toEqual(['db.save']);
      expect(rules[0].pattern.forbid_import).toEqual(['bad-lib']);
      expect(rules[0].pattern.require_config).toEqual(['timeout']);
    });

    it('should return empty array when input is empty array', () => {
      expect(parseInvariantRules([])).toEqual([]);
    });

    it('should throw ConfigValidationError when rules root is not an array', () => {
      expect(() => parseInvariantRules('not-an-array')).toThrow(ConfigValidationError);
      expect(() => parseInvariantRules(123)).toThrow(ConfigValidationError);
      expect(() => parseInvariantRules(null)).toThrow(ConfigValidationError);
      expect(() => parseInvariantRules({})).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError when a rule is not an object', () => {
      expect(() => parseInvariantRules(['string-rule'])).toThrow(ConfigValidationError);
      expect(() => parseInvariantRules([null])).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError when rule id is missing or empty', () => {
      expect(() =>
        parseInvariantRules([
          {
            severity: 'critical',
            desc: 'Missing ID',
            pattern: { forbid_import: ['foo'] },
          },
        ])
      ).toThrow(ConfigValidationError);

      expect(() =>
        parseInvariantRules([
          {
            id: '   ',
            severity: 'critical',
            desc: 'Empty ID',
            pattern: { forbid_import: ['foo'] },
          },
        ])
      ).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError on duplicate rule IDs', () => {
      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-dup',
            severity: 'critical',
            desc: 'Rule 1',
            pattern: { forbid_import: ['foo'] },
          },
          {
            id: 'rule-dup',
            severity: 'warning',
            desc: 'Rule 2',
            pattern: { forbid_import: ['bar'] },
          },
        ])
      ).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError on invalid or missing severity', () => {
      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            severity: 'fatal', // invalid
            desc: 'Invalid severity',
            pattern: { forbid_import: ['foo'] },
          },
        ])
      ).toThrow(ConfigValidationError);

      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            desc: 'Missing severity',
            pattern: { forbid_import: ['foo'] },
          },
        ])
      ).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError on missing or empty desc', () => {
      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            severity: 'critical',
            pattern: { forbid_import: ['foo'] },
          },
        ])
      ).toThrow(ConfigValidationError);

      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            severity: 'critical',
            desc: '   ',
            pattern: { forbid_import: ['foo'] },
          },
        ])
      ).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError on missing or non-object pattern', () => {
      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            severity: 'critical',
            desc: 'Missing pattern',
          },
        ])
      ).toThrow(ConfigValidationError);

      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            severity: 'critical',
            desc: 'Array pattern',
            pattern: [],
          },
        ])
      ).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError when pattern has none of the required pattern keys', () => {
      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-1',
            severity: 'critical',
            desc: 'Pattern without any matcher key',
            pattern: {
              scope: 'src/**',
            },
          },
        ])
      ).toThrow(ConfigValidationError);
    });

    it('should throw ConfigValidationError when pattern values are invalid types', () => {
      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-invalid-forbid',
            severity: 'critical',
            desc: 'Invalid forbid_import',
            pattern: { forbid_import: [] },
          },
        ])
      ).toThrow(ConfigValidationError);

      expect(() =>
        parseInvariantRules([
          {
            id: 'rule-invalid-scope',
            severity: 'critical',
            desc: 'Invalid scope',
            pattern: {
              scope: 123,
              forbid_import: ['foo'],
            },
          },
        ])
      ).toThrow(ConfigValidationError);
    });
  });

  describe('parseInvariantsYaml', () => {
    it('should parse YAML with invariants property', () => {
      const yamlContent = `
invariants:
  - id: yaml-rule-1
    severity: critical
    desc: UI forbid database
    pattern:
      in_path: "src/ui/**"
      forbid_import:
        - "@prisma/client"
`;
      const rules = parseInvariantsYaml(yamlContent);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('yaml-rule-1');
      expect(rules[0].severity).toBe('critical');
      expect(rules[0].pattern.in_path).toBe('src/ui/**');
      expect(rules[0].pattern.forbid_import).toEqual(['@prisma/client']);
    });

    it('should parse YAML directly as an array of rules', () => {
      const yamlContent = `
- id: direct-array-rule
  severity: warning
  desc: Timeout required
  pattern:
    target:
      - fetch
    require_config:
      - timeout
`;
      const rules = parseInvariantsYaml(yamlContent);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('direct-array-rule');
      expect(rules[0].pattern.require_config).toEqual(['timeout']);
    });

    it('should return empty array for empty or whitespace YAML', () => {
      expect(parseInvariantsYaml('')).toEqual([]);
      expect(parseInvariantsYaml('   \n  \n')).toEqual([]);
    });

    it('should throw ConfigSyntaxError for malformed YAML', () => {
      const badYaml = `
invariants:
  - id: broken
    severity: [unclosed
`;
      expect(() => parseInvariantsYaml(badYaml)).toThrow(ConfigSyntaxError);
    });

    it('should throw ConfigValidationError when YAML root is neither array nor has invariants key', () => {
      const unrelatedYaml = `
name: MyProject
version: 1.0.0
`;
      expect(() => parseInvariantsYaml(unrelatedYaml)).toThrow(ConfigValidationError);
    });
  });

  describe('extractInvariantsFromMarkdown', () => {
    it('should extract invariants from a markdown \`\`\`yaml code block', () => {
      const markdown = `
# Architecture Guide

Here are our system invariants:

\`\`\`yaml
invariants:
  - id: md-rule-1
    severity: critical
    desc: Must save before call
    pattern:
      target:
        - llmClient.chat
      must_precede:
        - db.save
\`\`\`

More markdown text.
`;
      const rules = extractInvariantsFromMarkdown(markdown);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('md-rule-1');
      expect(rules[0].pattern.must_precede).toEqual(['db.save']);
    });

    it('should extract invariants from \`\`\`yml code block', () => {
      const markdown = `
\`\`\`yml
invariants:
  - id: yml-rule
    severity: info
    desc: Forbidden import in utils
    pattern:
      scope: src/utils/**
      forbid_import:
        - fs
\`\`\`
`;
      const rules = extractInvariantsFromMarkdown(markdown);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('yml-rule');
    });

    it('should ignore non-invariants yaml code blocks', () => {
      const markdown = `
\`\`\`yaml
docker_compose:
  version: "3"
  services:
    app:
      image: node:18
\`\`\`

\`\`\`yaml
invariants:
  - id: matched-rule
    severity: critical
    desc: Only this should be extracted
    pattern:
      forbid_import: ["crypto"]
\`\`\`
`;
      const rules = extractInvariantsFromMarkdown(markdown);
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('matched-rule');
    });

    it('should extract and combine multiple invariants yaml blocks in markdown', () => {
      const markdown = `
\`\`\`yaml
invariants:
  - id: block-1-rule
    severity: critical
    desc: Rule from block 1
    pattern:
      forbid_import: ["bad-lib-1"]
\`\`\`

Some intermediate documentation.

\`\`\`yaml
invariants:
  - id: block-2-rule
    severity: warning
    desc: Rule from block 2
    pattern:
      forbid_import: ["bad-lib-2"]
\`\`\`
`;
      const rules = extractInvariantsFromMarkdown(markdown);
      expect(rules).toHaveLength(2);
      expect(rules[0].id).toBe('block-1-rule');
      expect(rules[1].id).toBe('block-2-rule');
    });

    it('should return empty array if no yaml invariants block is found', () => {
      const markdown = `
# Architecture Spec
\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`
`;
      expect(extractInvariantsFromMarkdown(markdown)).toEqual([]);
    });

    it('should throw ConfigValidationError on duplicate rule IDs across markdown blocks', () => {
      const markdown = `
\`\`\`yaml
invariants:
  - id: duplicate-id
    severity: critical
    desc: First instance
    pattern:
      forbid_import: ["foo"]
\`\`\`

\`\`\`yaml
invariants:
  - id: duplicate-id
    severity: warning
    desc: Second instance
    pattern:
      forbid_import: ["bar"]
\`\`\`
`;
      expect(() => extractInvariantsFromMarkdown(markdown)).toThrow(ConfigValidationError);
    });
  });
});
