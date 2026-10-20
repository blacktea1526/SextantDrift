import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { SextantMcpServer, SEXTANT_MCP_TOOLS } from '../src/server.js';
import { runCheckDrift } from '../src/tools/check-drift.js';
import { runInitTarget } from '../src/tools/init-target.js';
import { explainViolation } from '../src/tools/explain-violation.js';

describe('Sextant MCP Server', () => {
  const server = new SextantMcpServer('2.0.0');

  it('should expose 4 standard architectural verification tools in SEXTANT_MCP_TOOLS', () => {
    const toolNames = SEXTANT_MCP_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('check_file');
    expect(toolNames).toContain('check_drift');
    expect(toolNames).toContain('init_target');
    expect(toolNames).toContain('explain_violation');
  });

  it('should respond to initialize method conforming to MCP 2024-11-05 spec', async () => {
    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Cursor', version: '0.45.0' },
      },
    });

    const resRaw = await server.handleMessage(req);
    expect(resRaw).toBeDefined();
    const res = JSON.parse(resRaw!);

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result.protocolVersion).toBe('2024-11-05');
    expect(res.result.serverInfo.name).toBe('sextant-drift-mcp');
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it('should respond to tools/list with all tool definitions', async () => {
    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const resRaw = await server.handleMessage(req);
    const res = JSON.parse(resRaw!);

    expect(res.id).toBe(2);
    expect(res.result.tools).toHaveLength(4);
    const names = res.result.tools.map((t: any) => t.name);
    expect(names).toEqual(['check_file', 'check_drift', 'init_target', 'explain_violation']);
  });

  it('should respond to ping method', async () => {
    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 99,
      method: 'ping',
    });

    const resRaw = await server.handleMessage(req);
    const res = JSON.parse(resRaw!);
    expect(res.id).toBe(99);
    expect(res.result).toEqual({});
  });

  it('should execute check_drift tool via tools/call on clean fixture', async () => {
    const cleanFixtureDir = path.resolve(
      process.cwd(),
      'packages/core/tests/fixtures/clean-layered-app'
    );

    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'check_drift',
        arguments: {
          rootDir: cleanFixtureDir,
        },
      },
    });

    const resRaw = await server.handleMessage(req);
    const res = JSON.parse(resRaw!);

    expect(res.id).toBe(3);
    expect(res.result.content[0].type).toBe('text');

    const data = JSON.parse(res.result.content[0].text);
    expect(data.status).toBe('clean');
    expect(data.driftCount).toBe(0);
    expect(data.violations).toHaveLength(0);
  });

  it('should execute check_drift tool via tools/call on drifted fixture and report violations', async () => {
    const driftedFixtureDir = path.resolve(
      process.cwd(),
      'packages/core/tests/fixtures/drifted-bypass-app'
    );

    const res = await runCheckDrift({ rootDir: driftedFixtureDir });
    expect(res.status).toBe('drifted');
    expect(res.driftCount).toBeGreaterThanOrEqual(1);
    expect(res.violations.length).toBeGreaterThanOrEqual(1);
    expect(res.violations[0].type).toContain('BYPASS');
  });

  it('should execute init_target tool and return candidate TargetArchitecture', async () => {
    const cleanFixtureDir = path.resolve(
      process.cwd(),
      'packages/core/tests/fixtures/clean-layered-app'
    );

    const arch = runInitTarget({ rootDir: cleanFixtureDir });
    expect(arch.layers.length).toBeGreaterThanOrEqual(1);
    expect(arch.components.length).toBeGreaterThanOrEqual(1);
    expect(arch.allowDependencies.length).toBeGreaterThanOrEqual(1);
  });

  it('should execute check_file tool via tools/call and report clean status for compliant code', async () => {
    const cleanFixtureDir = path.resolve(
      process.cwd(),
      'packages/core/tests/fixtures/clean-layered-app'
    );

    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'check_file',
        arguments: {
          rootDir: cleanFixtureDir,
          filePath: 'src/controllers/user.controller.ts',
          fileContent: `import { UserService } from '../services/user.service.js';\nexport class UserController {}`,
        },
      },
    });

    const resRaw = await server.handleMessage(req);
    const res = JSON.parse(resRaw!);

    expect(res.id).toBe(10);
    expect(res.result.content[0].type).toBe('text');

    const data = JSON.parse(res.result.content[0].text);
    expect(data.valid).toBe(true);
    expect(data.violations).toHaveLength(0);
    expect(data.durationMs).toBeLessThan(100);
  });

  it('should execute check_file tool via tools/call and report violations for layer bypass', async () => {
    const cleanFixtureDir = path.resolve(
      process.cwd(),
      'packages/core/tests/fixtures/clean-layered-app'
    );

    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'check_file',
        arguments: {
          rootDir: cleanFixtureDir,
          filePath: 'src/controllers/user.controller.ts',
          fileContent: `import { UserRepository } from '../repos/user.repository.js';\nexport class UserController {}`,
        },
      },
    });

    const resRaw = await server.handleMessage(req);
    const res = JSON.parse(resRaw!);

    expect(res.id).toBe(11);
    const data = JSON.parse(res.result.content[0].text);
    expect(data.valid).toBe(false);
    expect(data.violations.length).toBeGreaterThanOrEqual(1);
    expect(data.violations[0].type).toBe('CRITICAL_BYPASS');
  });

  it('should execute explain_violation tool with deterministic advice', () => {
    const explanation = explainViolation({
      violationType: 'LAYER_BYPASS',
      sourceFile: 'src/controllers/order.controller.ts',
      line: 12,
    });

    expect(explanation.title).toContain('Layer Bypass');
    expect(explanation.remedy).toContain('domain service');
    expect(explanation.codeExample?.antiPattern).toBeDefined();
    expect(explanation.codeExample?.refactored).toBeDefined();
  });

  it('should return method not found for unknown method or unknown tool', async () => {
    const reqMethod = JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'unknown_method',
    });
    const resMethod = JSON.parse((await server.handleMessage(reqMethod))!);
    expect(resMethod.error.code).toBe(-32601);

    const reqTool = JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'non_existent_tool' },
    });
    const resTool = JSON.parse((await server.handleMessage(reqTool))!);
    expect(resTool.error.code).toBe(-32601);
  });
});
