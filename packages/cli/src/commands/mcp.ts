import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';
import { EXIT_CODE_SUCCESS, EXIT_CODE_FATAL_ERROR } from '../utils/exit.js';

import { fileURLToPath } from 'node:url';

declare const __CLI_VERSION__: string | undefined;
const CLI_VERSION = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '2.0.3';

export interface McpCommandOptions {
  global?: boolean;
}

export async function runMcp(action?: string, options: McpCommandOptions = {}): Promise<number> {
  if (action === 'install') {
    return installMcpConfig(options);
  }

  try {
    const { SextantMcpServer } = await import('@sextant/mcp-server');
    const server = new SextantMcpServer(CLI_VERSION);
    server.startStdio();
    return new Promise(() => {
      // Keeps running until process exits or stdin closes
    });
  } catch {
    // Fallback if @sextant/mcp-server is somehow unavailable
    const { spawn } = await import('node:child_process');
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidatePaths = [
      path.resolve(dirname, 'mcp-server.js'),
      path.resolve(dirname, '../bin/mcp-server.js'),
      path.resolve(dirname, '../../../../packages/mcp-server/dist/bin/mcp-server.js'),
      path.resolve(dirname, '../../mcp-server/dist/bin/mcp-server.js'),
    ];

    const mcpBin = candidatePaths.find((p) => fs.existsSync(p));

    if (mcpBin) {
      const child = spawn(process.execPath, [mcpBin], {
        stdio: 'inherit',
        env: process.env,
      });
      return new Promise((resolve) => {
        child.on('exit', (code) => resolve(code ?? 0));
      });
    }

    const child = spawn('npx', ['-y', '@sextant/mcp-server'], {
      stdio: 'inherit',
      env: process.env,
    });
    return new Promise((resolve) => {
      child.on('exit', (code) => resolve(code ?? 0));
    });
  }
}

type McpServerEntry = {
  command: string;
  args: string[];
};

type MergeMcpConfigResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; reason: string };

/**
 * Load an existing MCP config (if any) and merge in the sextant-drift server entry.
 * Never invents an empty config over a corrupt/invalid file — callers must leave
 * the original file untouched when ok is false.
 */
function mergeSextantIntoMcpConfig(
  configPath: string,
  entry: McpServerEntry,
): MergeMcpConfigResult {
  if (!fs.existsSync(configPath)) {
    return {
      ok: true,
      config: { mcpServers: { 'sextant-drift': entry } },
    };
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      reason: `Invalid JSON in ${configPath}; leaving file unchanged`,
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: `MCP config at ${configPath} is not a JSON object; leaving file unchanged`,
    };
  }

  const config = parsed as Record<string, unknown>;
  const existingServers = config.mcpServers;

  if (
    existingServers === undefined ||
    existingServers === null ||
    typeof existingServers !== 'object' ||
    Array.isArray(existingServers)
  ) {
    return {
      ok: false,
      reason: `MCP config at ${configPath} has missing or invalid mcpServers; leaving file unchanged`,
    };
  }

  return {
    ok: true,
    config: {
      ...config,
      mcpServers: {
        ...(existingServers as Record<string, unknown>),
        'sextant-drift': entry,
      },
    },
  };
}

function installMcpConfig(options: McpCommandOptions): number {
  const homeDir = os.homedir();
  const cwd = process.cwd();

  const mcpConfigEntry: McpServerEntry = {
    command: 'npx',
    args: ['-y', 'sextant-drift', 'mcp'],
  };

  let installedCount = 0;
  let failedCount = 0;

  // 1. Cursor MCP Configuration
  // Local project config: .cursor/mcp.json
  // Global config: ~/.cursor/mcp.json
  const cursorConfigPath = options.global
    ? path.join(homeDir, '.cursor', 'mcp.json')
    : path.join(cwd, '.cursor', 'mcp.json');

  try {
    const cursorDir = path.dirname(cursorConfigPath);
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    const merged = mergeSextantIntoMcpConfig(cursorConfigPath, mcpConfigEntry);
    if (!merged.ok) {
      console.warn(pc.yellow(`⚠ Could not install Cursor MCP config: ${merged.reason}`));
      failedCount++;
    } else {
      fs.writeFileSync(cursorConfigPath, JSON.stringify(merged.config, null, 2), 'utf-8');
      console.log(pc.green(`✔ Installed SextantDrift MCP tool in Cursor config: ${pc.cyan(cursorConfigPath)}`));
      installedCount++;
    }
  } catch (err: any) {
    console.warn(pc.yellow(`⚠ Could not write Cursor MCP config: ${err?.message}`));
    failedCount++;
  }

  // 2. Claude Desktop / Claude Code MCP config
  const claudeConfigDir = process.platform === 'darwin'
    ? path.join(homeDir, 'Library', 'Application Support', 'Claude')
    : path.join(homeDir, '.config', 'claude');
  const claudeConfigPath = path.join(claudeConfigDir, 'claude_desktop_config.json');

  try {
    if (fs.existsSync(claudeConfigDir)) {
      const merged = mergeSextantIntoMcpConfig(claudeConfigPath, mcpConfigEntry);
      if (!merged.ok) {
        console.warn(pc.yellow(`⚠ Could not install Claude MCP config: ${merged.reason}`));
        failedCount++;
      } else {
        fs.writeFileSync(claudeConfigPath, JSON.stringify(merged.config, null, 2), 'utf-8');
        console.log(pc.green(`✔ Installed SextantDrift MCP tool in Claude config: ${pc.cyan(claudeConfigPath)}`));
        installedCount++;
      }
    }
  } catch (err: any) {
    console.warn(pc.yellow(`⚠ Could not write Claude MCP config: ${err?.message}`));
    failedCount++;
  }

  if (failedCount > 0) {
    console.warn(
      pc.yellow(
        `\n⚠ SextantDrift MCP install finished with ${failedCount} failed target(s); ${installedCount} succeeded. Existing corrupt configs were left untouched.`,
      ),
    );
    return EXIT_CODE_FATAL_ERROR;
  }

  console.log(pc.bold(pc.green(`\n✔ SextantDrift MCP Server successfully installed into ${installedCount} IDE/Agent config(s).`)));
  console.log(pc.gray(`Available Tools for Agents:`));
  console.log(pc.gray(`  - check_file: Real-time incremental file guardrail before saving/committing`));
  console.log(pc.gray(`  - check_drift: Run architectural drift check`));
  console.log(pc.gray(`  - init_target: Deduce target architecture specification`));
  console.log(pc.gray(`  - explain_violation: Explain violation with deterministic AST-grounded advice\n`));

  return EXIT_CODE_SUCCESS;
}
