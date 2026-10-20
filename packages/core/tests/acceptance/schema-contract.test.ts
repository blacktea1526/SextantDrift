import { describe, expect, it } from 'vitest';
import schema from '../../../../schemas/sextant.schema.json';
import { parseAcceptanceConfig } from '../../src/index.js';

const properties = schema.properties.acceptance.properties;
type StringRule = { minLength?: number; pattern?: string };
// Executes the actual published string constraints; this is not a full JSON Schema validator.
function acceptsString(rule: StringRule, value: string): boolean {
  return value.length >= (rule.minLength ?? 0) && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

const config = (testFile: string, testName = 'order suite saves before payment') => ({
  requirements: [], scenarios: [{ id: 'checkout' }],
  checks: [{ id: 'save', scenarioId: 'checkout', testFile, testName, required: true }],
});

describe('published acceptance schema string semantics', () => {
  it('keeps businessRequirements optional so an old configuration still omits the field', () => {
    expect(schema.required).not.toContain('businessRequirements');
    expect(schema.properties.businessRequirements).toBeTypeOf('object');
  });

  it.each([
    ['order.test.ts', true], ['tests/order..test.ts', true], ['tests/my order.test.ts', true],
    ['../order.test.ts', false], ['./order.test.ts', false], ['/order.test.ts', false],
    ['C:/order.test.ts', false], ['tests\\order.test.ts', false], ['tests//order.test.ts', false],
    ['tests/', false], ['tests/../order.test.ts', false], ['tests/ /order.test.ts', false],
    ['order\u0000.test.ts', false], ['', false], ['   ', false],
  ] as const)('agrees with runtime parsing for test path %j', (path, valid) => {
    expect(acceptsString(properties.checks.items.properties.testFile, path)).toBe(valid);
    if (valid) expect(() => parseAcceptanceConfig(config(path))).not.toThrow();
    else expect(() => parseAcceptanceConfig(config(path))).toThrow();
  });

  it.each(['id', 'designRef'] as const)('requires a nonblank requirement %s', field => {
    const rule = properties.requirements.items.properties[field];
    expect(acceptsString(rule, 'ORD-1')).toBe(true);
    expect(acceptsString(rule, ' \t ')).toBe(false);
  });

  it('requires nonblank scenario/check/confirmation identifiers and accepts ordinary full test names', () => {
    const rules = [properties.scenarios.items.properties.id, properties.checks.items.properties.id,
      properties.checks.items.properties.scenarioId, properties.checks.items.properties.testName,
      properties.confirmation.properties.confirmedBy, properties.requirements.items.properties.checkIds.items];
    for (const rule of rules) {
      expect(acceptsString(rule, 'order suite saves before payment')).toBe(true);
      expect(acceptsString(rule, ' \t ')).toBe(false);
    }
  });
});
