# @sextant/web-report

> **SextantDrift Web Report** — 100% 离线自包含的原生 SVG 双图架构审查与可视化差分引擎 (Architecture Diff Visualizer & C4 SVG Canvas Engine).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 核心特性 (Key Features)

- **100% 零网络、零 CDN 依赖**：纯原生矢量 SVG 动态渲染，在隔离网络环境、军工/金融沙盒、离线 CI 机房均可双击秒级打开；
- **C4 多层级模型拓扑**：支持 Level 2（容器级概览）与 Level 3（组件级依赖）的无缝平滑钻取；
- **无限平移与缩放 (Pan & Zoom)**：自研变换矩阵视口控制，支持鼠标滚轮无限缩放、抓手拖拽与双击复位；
- **组件聚焦探针与契约过滤**：一键过滤底层通用横切依赖连线（消除 80% 视觉杂讯），单选组件高亮全部直接上下游流向；
- **红绿双图与同图差分**：直观展示设计意图（Target）与真实代码拓扑（Actual）的红线夹角与跨层越界；
- **中英双语国际化与 XSS 防护**：原生内置 `zh-CN` 与 `en` 实时语言切换，全局 HTML/JSON 实体转义杜绝代码注入。

---

## 安装与使用 (Installation & Usage)

### 配合 SextantDrift CLI 使用
当安装此包后，SextantDrift CLI 将自动启用高保真原生 SVG 双图报告生成功能：

```bash
# 推荐全局或项目本地安装
npm install -D @sextant/web-report
# 或
pnpm add -D @sextant/web-report

# 运行架构门禁并输出 HTML 可视化报告
npx sextant-drift check --report
# 或直接生成报告
npx sextant-drift report
```

### 编程式调用 (Node.js API)

```typescript
import { analyzeModuleDrift } from '@sextant/core';
import { generateHtmlReport } from '@sextant/web-report';
import fs from 'node:fs';

const report = await analyzeModuleDrift({ rootDir: '.' });
const html = generateHtmlReport(report, { lang: 'zh' });

fs.writeFileSync('drift-report.html', html, 'utf-8');
```

---

## 协议 (License)

[MIT](LICENSE)
