#!/usr/bin/env node

/**
 * SextantDrift — Engineering Workbench Dev Server
 * Zero-dependency pure Node.js HTTP server for previewing the visual drafting bench (index.html)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';

function serveStatic(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let reqPath = decodeURIComponent(parsedUrl.pathname);

  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${safePath}`);
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 Internal Server Error: ${readErr.message}`);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(content);
    });
  });
}

function startServer(initialPort = DEFAULT_PORT) {
  let port = initialPort;
  const server = http.createServer(serveStatic);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\x1b[33m[提示] 端口 ${port} 已被占用，正在尝试端口 ${port + 1}...\x1b[0m`);
      port++;
      server.listen(port, HOST);
    } else {
      console.error('\x1b[31m[错误] 服务启动异常:\x1b[0m', err);
      process.exit(1);
    }
  });

  server.listen(port, HOST, () => {
    const url = `http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${port}`;
    console.log('\x1b[36m%s\x1b[0m', '┌─────────────────────────────────────────────────────────────┐');
    console.log('\x1b[36m│\x1b[0m \x1b[1m\x1b[32mSextantDrift\x1b[0m — 架构 X 光机与偏航检测罗盘 (Workbench)       \x1b[36m│\x1b[0m');
    console.log('\x1b[36m├─────────────────────────────────────────────────────────────┤\x1b[0m');
    console.log(`\x1b[36m│\x1b[0m  本地工作台: \x1b[1m\x1b[34m${url}\x1b[0m                             \x1b[36m│\x1b[0m`);
    console.log(`\x1b[36m│\x1b[0m  图纸视图  : \x1b[33mEngineering Drafting Edition (index.html)\x1b[0m       \x1b[36m│\x1b[0m`);
    console.log(`\x1b[36m│\x1b[0m  测试看板  : \x1b[32mpnpm test:ui (执行 vitest --ui 查看)\x1b[0m           \x1b[36m│\x1b[0m`);
    console.log('\x1b[36m├─────────────────────────────────────────────────────────────┤\x1b[0m');
    console.log('\x1b[36m│\x1b[0m  按 \x1b[1mCtrl+C\x1b[0m 退出本地预览服务                                 \x1b[36m│\x1b[0m');
    console.log('\x1b[36m└─────────────────────────────────────────────────────────────┘\x1b[0m');
  });

  process.on('SIGINT', () => {
    console.log('\n\x1b[33m正在关闭 SextantDrift 开发服务器...\x1b[0m');
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();
