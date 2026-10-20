import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runMcp } from '../src/commands/mcp.js';

describe('CLI mcp Command', () => {
  const tmpDir = path.join(os.tmpdir(), `sextant-mcp-test-${Date.now()}`);
  const originalCwd = process.cwd();

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('should install MCP configuration into local .cursor/mcp.json', async () => {
    const code = await runMcp('install');
    expect(code).toBe(0);

    const cursorConfigPath = path.join(tmpDir, '.cursor', 'mcp.json');
    expect(fs.existsSync(cursorConfigPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf-8'));
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers['sextant-drift']).toBeDefined();
    expect(config.mcpServers['sextant-drift'].command).toBe('npx');
    expect(config.mcpServers['sextant-drift'].args).toEqual(['-y', 'sextant-drift', 'mcp']);
  });

  it('should preserve existing other mcpServers when installing', async () => {
    const cursorDir = path.join(tmpDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const cursorConfigPath = path.join(cursorDir, 'mcp.json');

    const existing = {
      mcpServers: {
        'other-server': {
          command: 'node',
          args: ['other.js'],
        },
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
        },
      },
      extraTopLevel: true,
    };
    fs.writeFileSync(cursorConfigPath, JSON.stringify(existing, null, 2), 'utf-8');

    const code = await runMcp('install');
    expect(code).toBe(0);

    const config = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf-8'));
    expect(config.extraTopLevel).toBe(true);
    expect(config.mcpServers['other-server']).toEqual({
      command: 'node',
      args: ['other.js'],
    });
    expect(config.mcpServers.filesystem).toEqual({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    });
    expect(config.mcpServers['sextant-drift']).toEqual({
      command: 'npx',
      args: ['-y', 'sextant-drift', 'mcp'],
    });
  });

  it('should not wipe corrupt JSON and should fail that install target', async () => {
    const cursorDir = path.join(tmpDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const cursorConfigPath = path.join(cursorDir, 'mcp.json');

    const corrupt = '{ "mcpServers": { "keep-me": { "command": "node" }';'; // broken';
    fs.writeFileSync(cursorConfigPath, corrupt, 'utf-8');

    const code = await runMcp('install');
    expect(code).not.toBe(0);

    const after = fs.readFileSync(cursorConfigPath, 'utf-8');
    expect(after).toBe(corrupt);
  });

  it('should refuse to write when mcpServers structure is invalid', async () => {
    const cursorDir = path.join(tmpDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const cursorConfigPath = path.join(cursorDir, 'mcp.json');

    const invalid = JSON.stringify({ mcpServers: ['not-an-object'] }, null, 2);
    fs.writeFileSync(cursorConfigPath, invalid, 'utf-8');

    const code = await runMcp('install');
    expect(code).not.toBe(0);

    const after = fs.readFileSync(cursorConfigPath, 'utf-8');
    expect(after).toBe(invalid);
  });
});
