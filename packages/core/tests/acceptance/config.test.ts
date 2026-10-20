import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseAcceptanceConfig } from '../../src/acceptance/config.js';
import { parseJsonSpec } from '../../src/parser/json-spec-parser.js';
import { ConfigValidationError } from '../../src/errors/config-error.js';

describe('R3 Acceptance Config Parser', () => {
  describe('Slice 1: Basic acceptance roundtrip and parseJsonSpec regression', () => {
    it('ensures parseJsonSpec does not add acceptance property when not declared in JSON', () => {
      const minimalSpec = JSON.stringify({
        layers: [
          { id: 'ui', order: 1 },
          { id: 'domain', order: 2 },
        ],
        components: [
          { id: 'ui-comp', layerId: 'ui', paths: ['src/ui/**'] },
          { id: 'domain-comp', layerId: 'domain', paths: ['src/domain/**'] },
        ],
      });

      const parsed = parseJsonSpec(minimalSpec);
      expect('acceptance' in parsed).toBe(false);
      expect(parsed.acceptance).toBeUndefined();
      expect(parsed.layers).toHaveLength(2);
      expect(parsed.components).toHaveLength(2);
    });

    it('parses valid acceptance config roundtrip directly and via parseJsonSpec', () => {
      const validAcceptance = {
        requirements: [
          {
            id: 'REQ-01',
            designRef: 'docs/design.md#req-1',
            checkIds: ['CHK-01'],
          },
        ],
        scenarios: [{ id: 'SCN-01' }],
        checks: [
          {
            id: 'CHK-01',
            scenarioId: 'SCN-01',
            testFile: 'tests/acceptance/sample.test.ts',
            testName: 'sample requirement check',
            required: true,
          },
        ],
      };

      const result = parseAcceptanceConfig(validAcceptance);
      expect(result).toEqual(validAcceptance);

      const specWithAcceptance = JSON.stringify({
        layers: [{ id: 'core', order: 1 }],
        components: [{ id: 'c1', layerId: 'core', paths: ['src/**'] }],
        acceptance: validAcceptance,
      });

      const parsedSpec = parseJsonSpec(specWithAcceptance);
      expect('acceptance' in parsedSpec).toBe(true);
      expect(parsedSpec.acceptance).toEqual(validAcceptance);
    });
  });

  describe('Slice 2: Strict types, unknown fields, non-empty strings, and required boolean', () => {
    it('rejects non-object root value', () => {
      expect(() => parseAcceptanceConfig(null)).toThrow(ConfigValidationError);
      expect(() => parseAcceptanceConfig('invalid')).toThrow(ConfigValidationError);
      expect(() => parseAcceptanceConfig([1, 2, 3])).toThrow(ConfigValidationError);

      try {
        parseAcceptanceConfig(null);
      } catch (e) {
        expect((e as ConfigValidationError).field).toBe('acceptance');
      }
    });

    it('rejects unknown fields in root acceptance object', () => {
      const withExtra = {
        requirements: [],
        scenarios: [],
        checks: [],
        unknownField: true,
      };
      expect(() => parseAcceptanceConfig(withExtra)).toThrow(ConfigValidationError);
      try {
        parseAcceptanceConfig(withExtra);
      } catch (e) {
        expect((e as ConfigValidationError).field).toBe('acceptance.unknownField');
      }
    });

    it('rejects unknown fields in requirement, scenario, check, or confirmation', () => {
      // In scenario
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1', extra: 'bad' }],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // In requirement
      expect(() =>
        parseAcceptanceConfig({
          requirements: [{ id: 'R1', designRef: 'ref', checkIds: [], extra: 123 }],
          scenarios: [],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // In check
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1' }],
          checks: [
            {
              id: 'C1',
              scenarioId: 'S1',
              testFile: 'src/a.test.ts',
              testName: 'test 1',
              required: true,
              extra: 'nope',
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('rejects non-empty string violations across fields', () => {
      // Empty requirement id
      expect(() =>
        parseAcceptanceConfig({
          requirements: [{ id: '   ', designRef: 'ref', checkIds: [] }],
          scenarios: [],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // Empty designRef
      expect(() =>
        parseAcceptanceConfig({
          requirements: [{ id: 'R1', designRef: '', checkIds: [] }],
          scenarios: [],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // Empty scenario id
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: '' }],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // Empty check id
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1' }],
          checks: [
            {
              id: '',
              scenarioId: 'S1',
              testFile: 'a.test.ts',
              testName: 't',
              required: true,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('enforces check.required is strictly a boolean with no default', () => {
      // Missing required
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1' }],
          checks: [
            {
              id: 'C1',
              scenarioId: 'S1',
              testFile: 'a.test.ts',
              testName: 't',
            },
          ],
        })
      ).toThrow(ConfigValidationError);

      // String required
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1' }],
          checks: [
            {
              id: 'C1',
              scenarioId: 'S1',
              testFile: 'a.test.ts',
              testName: 't',
              required: 'true',
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });
  });

  describe('Slice 3: Path safety, testName validation, confirmation hashes, and immutability', () => {
    it('rejects invalid testFile paths (absolute, traversal, backslashes, empty segments, dot segments)', () => {
      const invalidPaths = [
        '/absolute/path.test.ts',
        '../traversal.test.ts',
        'sub/../traversal.test.ts',
        './relative.test.ts',
        'sub/./relative.test.ts',
        'win\\path.test.ts',
        'empty//segment.test.ts',
        'trailing/slash.test.ts/',
        '.',
        '..',
        '   ',
      ];

      for (const p of invalidPaths) {
        expect(() =>
          parseAcceptanceConfig({
            requirements: [],
            scenarios: [{ id: 'S1' }],
            checks: [
              {
                id: 'C1',
                scenarioId: 'S1',
                testFile: p,
                testName: 'valid test',
                required: true,
              },
            ],
          })
        ).toThrow(ConfigValidationError);
      }
    });

    it('accepts valid POSIX project-relative file paths and testName with whitespace', () => {
      const validPaths = [
        'test.ts',
        'tests/acceptance/sample.test.ts',
        'src/modules/order/order.spec.js',
      ];

      for (const p of validPaths) {
        const parsed = parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1' }],
          checks: [
            {
              id: 'C1',
              scenarioId: 'S1',
              testFile: p,
              testName: 'Order Service > should create order with valid ports',
              required: true,
            },
          ],
        });
        expect(parsed.checks[0].testFile).toBe(p);
        expect(parsed.checks[0].testName).toBe('Order Service > should create order with valid ports');
      }
    });

    it('rejects whitespace-only testName', () => {
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'S1' }],
          checks: [
            {
              id: 'C1',
              scenarioId: 'S1',
              testFile: 'sample.test.ts',
              testName: '   \t\n',
              required: true,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('validates confirmation strictly with 64-char lowercase hex sha256', () => {
      const validHash = 'a'.repeat(64);
      const validConfirmation = {
        confirmedBy: 'tester@example.com',
        designHash: validHash,
        acceptanceHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        configHash: 'f'.repeat(64),
      };

      const parsed = parseAcceptanceConfig({
        requirements: [],
        scenarios: [],
        checks: [],
        confirmation: validConfirmation,
      });
      expect(parsed.confirmation).toEqual(validConfirmation);

      // Rejects uppercase hex
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [],
          checks: [],
          confirmation: {
            ...validConfirmation,
            designHash: 'A'.repeat(64),
          },
        })
      ).toThrow(ConfigValidationError);

      // Rejects non-64 length
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [],
          checks: [],
          confirmation: {
            ...validConfirmation,
            configHash: 'a'.repeat(63),
          },
        })
      ).toThrow(ConfigValidationError);

      // Rejects empty confirmedBy
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [],
          checks: [],
          confirmation: {
            ...validConfirmation,
            confirmedBy: '   ',
          },
        })
      ).toThrow(ConfigValidationError);
    });

    it('does not mutate input object and returns a fresh cloned object', () => {
      const input = {
        requirements: [
          {
            id: 'REQ-1',
            designRef: 'docs/design.md',
            checkIds: ['CHK-1'],
          },
        ],
        scenarios: [{ id: 'SCN-1' }],
        checks: [
          {
            id: 'CHK-1',
            scenarioId: 'SCN-1',
            testFile: 'src/test.ts',
            testName: 't',
            required: true,
          },
        ],
        confirmation: {
          confirmedBy: 'author',
          designHash: 'a'.repeat(64),
          acceptanceHash: 'b'.repeat(64),
          configHash: 'c'.repeat(64),
        },
      };

      // Deep freeze input to guarantee immutability
      Object.freeze(input);
      Object.freeze(input.requirements);
      Object.freeze(input.requirements[0]);
      Object.freeze(input.requirements[0].checkIds);
      Object.freeze(input.scenarios);
      Object.freeze(input.scenarios[0]);
      Object.freeze(input.checks);
      Object.freeze(input.checks[0]);
      Object.freeze(input.confirmation);

      const parsed = parseAcceptanceConfig(input);
      expect(parsed).toEqual(input);
      expect(parsed).not.toBe(input);
      expect(parsed.requirements).not.toBe(input.requirements);
      expect(parsed.requirements[0].checkIds).not.toBe(input.requirements[0].checkIds);
      expect(parsed.checks).not.toBe(input.checks);
      expect(parsed.scenarios).not.toBe(input.scenarios);
      expect(parsed.confirmation).not.toBe(input.confirmation);

      // Mutating parsed should not throw on frozen input
      parsed.requirements[0].checkIds.push('CHK-2');
      expect(input.requirements[0].checkIds).toHaveLength(1);
    });
  });

  describe('Slice 4: ID uniqueness, references, duplicate checkIds, exact test identity, and empty mappings', () => {
    it('allows valid incomplete empty mappings (empty collections or empty requirement checkIds)', () => {
      // All empty collections
      const emptyAll = parseAcceptanceConfig({
        requirements: [],
        scenarios: [],
        checks: [],
      });
      expect(emptyAll.requirements).toEqual([]);
      expect(emptyAll.scenarios).toEqual([]);
      expect(emptyAll.checks).toEqual([]);

      // Requirement with empty checkIds
      const emptyCheckIds = parseAcceptanceConfig({
        requirements: [
          {
            id: 'REQ-EMPTY',
            designRef: 'docs/design.md#empty',
            checkIds: [],
          },
        ],
        scenarios: [],
        checks: [],
      });
      expect(emptyCheckIds.requirements[0].checkIds).toEqual([]);
    });

    it('rejects duplicate IDs within the same collection', () => {
      // Duplicate requirement id
      expect(() =>
        parseAcceptanceConfig({
          requirements: [
            { id: 'REQ-1', designRef: 'ref1', checkIds: [] },
            { id: 'REQ-1', designRef: 'ref2', checkIds: [] },
          ],
          scenarios: [],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // Duplicate scenario id
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'SCN-1' }, { id: 'SCN-1' }],
          checks: [],
        })
      ).toThrow(ConfigValidationError);

      // Duplicate check id
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'SCN-1' }],
          checks: [
            {
              id: 'CHK-1',
              scenarioId: 'SCN-1',
              testFile: 'a.test.ts',
              testName: 'test A',
              required: true,
            },
            {
              id: 'CHK-1',
              scenarioId: 'SCN-1',
              testFile: 'b.test.ts',
              testName: 'test B',
              required: false,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('allows identical IDs across different collections (per-collection uniqueness)', () => {
      const crossSameId = parseAcceptanceConfig({
        requirements: [
          {
            id: 'SHARED-ID',
            designRef: 'docs/ref.md',
            checkIds: ['SHARED-ID'],
          },
        ],
        scenarios: [{ id: 'SHARED-ID' }],
        checks: [
          {
            id: 'SHARED-ID',
            scenarioId: 'SHARED-ID',
            testFile: 'shared.test.ts',
            testName: 'shared test',
            required: true,
          },
        ],
      });
      expect(crossSameId.requirements[0].id).toBe('SHARED-ID');
      expect(crossSameId.scenarios[0].id).toBe('SHARED-ID');
      expect(crossSameId.checks[0].id).toBe('SHARED-ID');
    });

    it('rejects dangling scenario references in checks', () => {
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'SCN-EXISTING' }],
          checks: [
            {
              id: 'CHK-1',
              scenarioId: 'SCN-NONEXISTENT',
              testFile: 'a.test.ts',
              testName: 'test A',
              required: true,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('rejects dangling check references in requirements', () => {
      expect(() =>
        parseAcceptanceConfig({
          requirements: [
            {
              id: 'REQ-1',
              designRef: 'ref',
              checkIds: ['CHK-NONEXISTENT'],
            },
          ],
          scenarios: [{ id: 'SCN-1' }],
          checks: [
            {
              id: 'CHK-1',
              scenarioId: 'SCN-1',
              testFile: 'a.test.ts',
              testName: 'test A',
              required: true,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('rejects duplicate checkIds within a single requirement', () => {
      expect(() =>
        parseAcceptanceConfig({
          requirements: [
            {
              id: 'REQ-1',
              designRef: 'ref',
              checkIds: ['CHK-1', 'CHK-1'],
            },
          ],
          scenarios: [{ id: 'SCN-1' }],
          checks: [
            {
              id: 'CHK-1',
              scenarioId: 'SCN-1',
              testFile: 'a.test.ts',
              testName: 'test A',
              required: true,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });

    it('rejects duplicate exact test identity (same testFile and testName)', () => {
      expect(() =>
        parseAcceptanceConfig({
          requirements: [],
          scenarios: [{ id: 'SCN-1' }, { id: 'SCN-2' }],
          checks: [
            {
              id: 'CHK-1',
              scenarioId: 'SCN-1',
              testFile: 'tests/order.test.ts',
              testName: 'Order Suite > should charge payment',
              required: true,
            },
            {
              id: 'CHK-2',
              scenarioId: 'SCN-2',
              testFile: 'tests/order.test.ts',
              testName: 'Order Suite > should charge payment',
              required: false,
            },
          ],
        })
      ).toThrow(ConfigValidationError);
    });
  });

  describe('Slice 5: sextant.schema.json structure and full parseJsonSpec integration', () => {
    it('verifies schemas/sextant.schema.json contains compliant acceptance definitions', () => {
      const schemaPath = path.resolve(process.cwd(), 'schemas/sextant.schema.json');
      expect(fs.existsSync(schemaPath)).toBe(true);

      const raw = fs.readFileSync(schemaPath, 'utf-8');
      const schema = JSON.parse(raw);

      expect(schema.properties).toHaveProperty('acceptance');
      const acc = schema.properties.acceptance;

      expect(acc.type).toBe('object');
      expect(acc.additionalProperties).toBe(false);
      expect(acc.required).toEqual(['requirements', 'scenarios', 'checks']);

      // requirements item schema
      expect(acc.properties.requirements.type).toBe('array');
      const reqItem = acc.properties.requirements.items;
      expect(reqItem.type).toBe('object');
      expect(reqItem.additionalProperties).toBe(false);
      expect(reqItem.required).toEqual(['id', 'designRef', 'checkIds']);
      expect(reqItem.properties.id.minLength).toBe(1);
      expect(reqItem.properties.designRef.minLength).toBe(1);
      expect(reqItem.properties.checkIds.type).toBe('array');
      expect(reqItem.properties.checkIds.items.minLength).toBe(1);

      // scenarios item schema
      expect(acc.properties.scenarios.type).toBe('array');
      const scnItem = acc.properties.scenarios.items;
      expect(scnItem.type).toBe('object');
      expect(scnItem.additionalProperties).toBe(false);
      expect(scnItem.required).toEqual(['id']);
      expect(scnItem.properties.id.minLength).toBe(1);

      // checks item schema
      expect(acc.properties.checks.type).toBe('array');
      const chkItem = acc.properties.checks.items;
      expect(chkItem.type).toBe('object');
      expect(chkItem.additionalProperties).toBe(false);
      expect(chkItem.required).toEqual(['id', 'scenarioId', 'testFile', 'testName', 'required']);
      expect(chkItem.properties.id.minLength).toBe(1);
      expect(chkItem.properties.scenarioId.minLength).toBe(1);
      expect(chkItem.properties.testFile.pattern).toBeDefined();
      expect(chkItem.properties.testName.pattern).toBeDefined();
      expect(chkItem.properties.required.type).toBe('boolean');

      // confirmation schema
      expect(acc.properties.confirmation.type).toBe('object');
      const conf = acc.properties.confirmation;
      expect(conf.additionalProperties).toBe(false);
      expect(conf.required).toEqual(['confirmedBy', 'designHash', 'acceptanceHash', 'configHash']);
      expect(conf.properties.confirmedBy.minLength).toBe(1);
      expect(conf.properties.designHash.pattern).toBe('^[0-9a-f]{64}$');
      expect(conf.properties.acceptanceHash.pattern).toBe('^[0-9a-f]{64}$');
      expect(conf.properties.configHash.pattern).toBe('^[0-9a-f]{64}$');
    });

    it('propagates ConfigValidationError when parseJsonSpec encounters invalid acceptance', () => {
      const invalidSpec = JSON.stringify({
        layers: [{ id: 'core', order: 1 }],
        components: [{ id: 'c1', layerId: 'core', paths: ['src/**'] }],
        acceptance: {
          requirements: [],
          scenarios: [],
          checks: [],
          extraIllegalField: 123,
        },
      });

      expect(() => parseJsonSpec(invalidSpec)).toThrow(ConfigValidationError);
    });

    it('parses full architecture spec with layers, components, invariants and acceptance without breaking existing checks', () => {
      const fullSpec = JSON.stringify({
        $schema: './schemas/sextant.schema.json',
        name: 'OrderProcessingSystem',
        layers: [
          { id: 'presentation', order: 1 },
          { id: 'application', order: 2 },
          { id: 'infrastructure', order: 3 },
        ],
        components: [
          { id: 'web', layerId: 'presentation', paths: ['src/web/**'] },
          { id: 'services', layerId: 'application', paths: ['src/services/**'] },
          { id: 'db', layerId: 'infrastructure', paths: ['src/db/**'] },
        ],
        allowDependencies: [
          { from: 'web', to: 'services' },
          { from: 'services', to: 'db' },
        ],
        invariants: [
          {
            id: 'INV-01',
            severity: 'critical',
            desc: 'Save state before calling payment gateway',
            pattern: {
              must_precede: ['db.save'],
              target: ['payment.charge'],
            },
          },
        ],
        acceptance: {
          requirements: [
            {
              id: 'REQ-ORDER-1',
              designRef: 'docs/design.md#order-placement',
              checkIds: ['CHK-1'],
            },
          ],
          scenarios: [{ id: 'SCN-ORDER-1' }],
          checks: [
            {
              id: 'CHK-1',
              scenarioId: 'SCN-ORDER-1',
              testFile: 'tests/order.test.ts',
              testName: 'Order > successful placement',
              required: true,
            },
          ],
          confirmation: {
            confirmedBy: 'architect@example.com',
            designHash: '1'.repeat(64),
            acceptanceHash: '2'.repeat(64),
            configHash: '3'.repeat(64),
          },
        },
      });

      const parsed = parseJsonSpec(fullSpec);
      expect(parsed.name).toBe('OrderProcessingSystem');
      expect(parsed.layers).toHaveLength(3);
      expect(parsed.components).toHaveLength(3);
      expect(parsed.allowDependencies).toHaveLength(2);
      expect(parsed.invariants).toHaveLength(1);
      expect(parsed.invariants?.[0].id).toBe('INV-01');
      expect(parsed.acceptance).toBeDefined();
      expect(parsed.acceptance?.requirements).toHaveLength(1);
      expect(parsed.acceptance?.scenarios).toHaveLength(1);
      expect(parsed.acceptance?.checks).toHaveLength(1);
      expect(parsed.acceptance?.confirmation?.confirmedBy).toBe('architect@example.com');
    });
  });
});




