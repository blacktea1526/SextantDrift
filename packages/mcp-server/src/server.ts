import readline from 'node:readline';
import { runCheckDrift } from './tools/check-drift.js';
import { runInitTarget } from './tools/init-target.js';
import { explainViolation } from './tools/explain-violation.js';
import { runCheckFile } from './tools/check-file.js';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const SEXTANT_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'check_file',
    description:
      'Performs real-time, low-latency (<20ms) architectural drift check on a single file before saving or committing. Verifies layer bypasses, layer inversions, forbidden imports, and file-scoped invariants directly from in-memory content.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Relative or absolute path of the file being edited (e.g. "src/controllers/user.controller.ts").',
        },
        fileContent: {
          type: 'string',
          description: 'The in-memory text content of the file to verify against architectural boundaries.',
        },
        rootDir: {
          type: 'string',
          description: 'Root directory of the project. Defaults to current working directory.',
        },
        specPath: {
          type: 'string',
          description: 'Optional custom path to sextant.json or spec file.',
        },
      },
      required: ['filePath', 'fileContent'],
    },
  },
  {
    name: 'check_drift',
    description:
      'Performs deterministic architectural drift check on the codebase. Compares actual code AST against Target Architecture and Semantic Invariants. Returns structured violations with file, line, and suggested fix.',
    inputSchema: {
      type: 'object',
      properties: {
        rootDir: {
          type: 'string',
          description: 'Absolute or relative root directory of the project to analyze. Defaults to current working directory.',
        },
        specPath: {
          type: 'string',
          description: 'Custom path to architecture spec file (sextant.json, ARCHITECTURE.md, etc.).',
        },
        strict: {
          type: 'boolean',
          description: 'If true, treat warnings as blocking violations.',
        },
      },
    },
  },
  {
    name: 'init_target',
    description:
      'Reverse-engineers project directory structure and dependencies to deduce initial target architecture specification (Reverse X-Ray). Returns candidate TargetArchitecture in sextant.json format.',
    inputSchema: {
      type: 'object',
      properties: {
        rootDir: {
          type: 'string',
          description: 'Root directory of the project to inspect.',
        },
        sourceDir: {
          type: 'string',
          description: 'Source code subfolder (e.g. "src"). Defaults to auto-detection.',
        },
      },
    },
  },
  {
    name: 'explain_violation',
    description:
      'Explains an architectural violation type (LAYER_BYPASS, LAYER_INVERSION, CIRCULAR_DEPENDENCY, INVARIANT_BROKEN) with 100% deterministic remediation advice and code examples (zero LLM hallucinations).',
    inputSchema: {
      type: 'object',
      properties: {
        violationType: {
          type: 'string',
          description: 'Type of violation: LAYER_BYPASS, LAYER_INVERSION, CIRCULAR_DEPENDENCY, INVARIANT_BROKEN, or STATE_DEADLOCK.',
        },
        ruleId: {
          type: 'string',
          description: 'Specific invariant rule ID if applicable.',
        },
        message: {
          type: 'string',
          description: 'Original violation error message.',
        },
      },
      required: ['violationType'],
    },
  },
];

export class SextantMcpServer {
  private rl?: readline.Interface;

  constructor(private readonly version: string = '2.0.3') {}

  public async handleMessage(rawMessage: string): Promise<string | null> {
    const trimmed = rawMessage.trim();
    if (!trimmed) return null;

    let request: any;
    try {
      request = JSON.parse(trimmed);
    } catch {
      return JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
      });
    }

    const { id, method, params } = request;

    // Notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        // Client confirmed initialization
        return null;
      }
      return null;
    }

    try {
      switch (method) {
        case 'initialize':
          return JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'sextant-drift-mcp',
                version: this.version,
              },
            },
          });

        case 'ping':
          return JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {},
          });

        case 'tools/list':
          return JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              tools: SEXTANT_MCP_TOOLS,
            },
          });

        case 'tools/call': {
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};

          let contentText: string;

          switch (toolName) {
            case 'check_file': {
              const res = runCheckFile(toolArgs as any);
              contentText = JSON.stringify(res, null, 2);
              break;
            }
            case 'check_drift': {
              const res = await runCheckDrift(toolArgs);
              contentText = JSON.stringify(res, null, 2);
              break;
            }
            case 'init_target': {
              const res = runInitTarget(toolArgs);
              contentText = JSON.stringify(res, null, 2);
              break;
            }
            case 'explain_violation': {
              const res = explainViolation(toolArgs);
              contentText = JSON.stringify(res, null, 2);
              break;
            }
            default:
              return JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Tool not found: ${toolName}` },
              });
          }

          return JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: contentText,
                },
              ],
            },
          });
        }

        default:
          return JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          });
      }
    } catch (err: any) {
      return JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: err?.message || 'Internal error' },
      });
    }
  }

  public startStdio(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', async (line) => {
      const response = await this.handleMessage(line);
      if (response) {
        process.stdout.write(response + '\n');
      }
    });

    process.on('SIGINT', () => {
      this.stop();
      process.exit(0);
    });
  }

  public stop(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
  }
}
