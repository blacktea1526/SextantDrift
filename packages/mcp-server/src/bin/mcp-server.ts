#!/usr/bin/env node

import { SextantMcpServer } from '../server.js';

declare const __MCP_VERSION__: string | undefined;

const version = typeof __MCP_VERSION__ !== 'undefined' ? __MCP_VERSION__ : '2.0.0';
const server = new SextantMcpServer(version);

server.startStdio();
