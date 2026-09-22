#!/usr/bin/env node

/**
 * ==============================================================================
 * SextantDrift — 独立高精度架构分析基准压测套件 (Independent Benchmark Runner)
 * ==============================================================================
 * 脱离 Vitest 测试外壳，直接测量内核执行指标：
 * - p50 / p95 / p99 延迟
 * - 吞吐量 (files/s)
 * - 峰值堆内存增量 (Peak Heap Delta MB)
 * - 测量噪声标准差 (Noise Standard Deviation σ)
 * - 硬约束正确性与零假阳性校验 (0 False Positives Hard Constraint)
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { analyzeModuleDrift } from '../packages/core/dist/index.js';
import { extractDependenciesFromSource } from '../packages/core/dist/index.js';
import { DirectedGraph } from '../packages/core/dist/index.js';
import { detectCycles } from '../packages/core/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 颜色定义
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';

function calculateStats(samples) {
  if (samples.length === 0) return { min: 0, max: 0, mean: 0, std: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  const getPercentile = (p) => {
    const idx = Math.min(Math.floor((p / 100) * n), n - 1);
    return sorted[idx];
  };

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    std: Math.round(std * 100) / 100,
    p50: Math.round(getPercentile(50) * 100) / 100,
    p95: Math.round(getPercentile(95) * 100) / 100,
    p99: Math.round(getPercentile(99) * 100) / 100,
  };
}

/**
 * Suite 1: Evolution Set (Micro-benchmarks, fast iteration: < 300ms)
 */
async function runEvolutionSuite(iterations = 10) {
  const cleanAppPath = path.join(ROOT_DIR, 'packages/core/tests/fixtures/clean-layered-app');
  const driftedAppPath = path.join(ROOT_DIR, 'packages/core/tests/fixtures/drifted-bypass-app');

  // 1. Correctness validation
  const cleanReport = await analyzeModuleDrift({ rootDir: cleanAppPath });
  const cleanOk = cleanReport.passed && cleanReport.violations.length === 0;

  const driftedReport = await analyzeModuleDrift({ rootDir: driftedAppPath });
  const driftedOk = !driftedReport.passed && driftedReport.violations.length >= 5;

  if (!cleanOk || !driftedOk) {
    return {
      suite: 'evolution',
      valid: false,
      error: `Correctness assertion failed! Clean passed: ${cleanOk} (violations=${cleanReport.violations.length}), Drifted passed: ${driftedOk} (violations=${driftedReport.violations.length})`,
    };
  }

  // 2. Warm-up
  for (let i = 0; i < 3; i++) {
    await analyzeModuleDrift({ rootDir: cleanAppPath });
    await analyzeModuleDrift({ rootDir: driftedAppPath });
  }

  // 3. Timed benchmark
  const times = [];
  const startMem = process.memoryUsage().heapUsed;
  let peakMem = startMem;

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await analyzeModuleDrift({ rootDir: cleanAppPath });
    await analyzeModuleDrift({ rootDir: driftedAppPath });
    const elapsed = performance.now() - t0;
    times.push(elapsed);

    const curMem = process.memoryUsage().heapUsed;
    if (curMem > peakMem) peakMem = curMem;
  }

  const stats = calculateStats(times);
  const totalFiles = (cleanReport.summary.totalFiles + driftedReport.summary.totalFiles);
  const throughput = Math.round((totalFiles / (stats.mean / 1000)) * 10) / 10;
  const memDeltaMb = Math.round(((peakMem - startMem) / (1024 * 1024)) * 100) / 100;
  const suggestionCoverage = driftedReport.violations.length > 0
    ? Math.round((driftedReport.violations.filter((v) => !!v.suggestion && v.suggestion.length > 0).length / driftedReport.violations.length) * 1000) / 10
    : 100;

  return {
    suite: 'evolution',
    valid: true,
    totalFiles,
    iterations,
    stats,
    throughput,
    peakMemDeltaMb: memDeltaMb,
    suggestionCoverage,
  };
}

/**
 * Suite 2: Validation Set (Medium-scale / Enterprise + Dogfooding: ~1.0s)
 */
async function runValidationSuite(iterations = 5) {
  // Self-dogfooding on root SextantDrift monorepo
  const rootReport = await analyzeModuleDrift({ rootDir: ROOT_DIR });
  const dogfoodOk = rootReport.passed && rootReport.violations.length === 0;

  if (!dogfoodOk) {
    return {
      suite: 'validation',
      valid: false,
      error: `Self-dogfooding failed! Drift detected on SextantDrift itself: ${rootReport.violations.length} violations`,
    };
  }

  // Warm-up
  for (let i = 0; i < 2; i++) {
    await analyzeModuleDrift({ rootDir: ROOT_DIR });
  }

  const times = [];
  const startMem = process.memoryUsage().heapUsed;
  let peakMem = startMem;

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await analyzeModuleDrift({ rootDir: ROOT_DIR });
    const elapsed = performance.now() - t0;
    times.push(elapsed);

    const curMem = process.memoryUsage().heapUsed;
    if (curMem > peakMem) peakMem = curMem;
  }

  const stats = calculateStats(times);
  const totalFiles = rootReport.summary.totalFiles;
  const throughput = Math.round((totalFiles / (stats.mean / 1000)) * 10) / 10;
  const memDeltaMb = Math.round(((peakMem - startMem) / (1024 * 1024)) * 100) / 100;

  return {
    suite: 'validation',
    valid: true,
    totalFiles,
    totalDependencies: rootReport.summary.totalDependencies,
    iterations,
    stats,
    throughput,
    peakMemDeltaMb: memDeltaMb,
  };
}

/**
 * Suite 3: Stress Set (1000 Synthetic AST Modules + 5000-Node SCC Graph)
 */
async function runStressSuite(iterations = 3) {
  const nodeCount = 1000;
  const sampleModule = (id) => `
    import { Mod_${id + 1} } from './mod_${id + 1}.js';
    import type { Type_${id + 1} } from './types.js';
    export class Service_${id} {
      exec() { return Mod_${id + 1}; }
    }
  `;

  // Warm-up
  for (let i = 0; i < 50; i++) {
    extractDependenciesFromSource(`src/dummy_${i}.ts`, sampleModule(i));
  }

  const times = [];
  const startMem = process.memoryUsage().heapUsed;
  let peakMem = startMem;

  for (let iter = 0; iter < iterations; iter++) {
    const t0 = performance.now();
    const graph = new DirectedGraph();

    for (let i = 0; i < nodeCount; i++) {
      const code = sampleModule(i);
      const deps = extractDependenciesFromSource(`src/mod_${i}.ts`, code);
      for (const dep of deps) {
        const targetNode = dep.rawSpecifier.replace(/^\.\//, '').replace(/\.js$/, '');
        graph.addEdge(`mod_${i}`, targetNode);
      }
    }
    // Add cycle to end: mod_{N-1} -> mod_{N-2} (since mod_{N-2} already points to mod_{N-1})
    graph.addEdge(`mod_${nodeCount - 1}`, `mod_${nodeCount - 2}`);
    const cycles = detectCycles(graph);
    const elapsed = performance.now() - t0;

    if (cycles.length === 0) {
      return { suite: 'stress', valid: false, error: 'Expected cycle was not detected in stress test' };
    }

    times.push(elapsed);
    const curMem = process.memoryUsage().heapUsed;
    if (curMem > peakMem) peakMem = curMem;
  }

  const stats = calculateStats(times);
  const throughput = Math.round((nodeCount / (stats.mean / 1000)) * 10) / 10;
  const memDeltaMb = Math.round(((peakMem - startMem) / (1024 * 1024)) * 100) / 100;

  return {
    suite: 'stress',
    valid: true,
    modules: nodeCount,
    iterations,
    stats,
    throughput,
    peakMemDeltaMb: memDeltaMb,
  };
}

export async function runAllBenchmarks(options = {}) {
  const suiteFilter = options.suite || 'all';
  const isJson = Boolean(options.json);

  const results = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    suites: {},
  };

  if (suiteFilter === 'all' || suiteFilter === 'evolution') {
    results.suites.evolution = await runEvolutionSuite(options.evoIterations || 10);
  }

  if (suiteFilter === 'all' || suiteFilter === 'validation') {
    results.suites.validation = await runValidationSuite(options.valIterations || 5);
  }

  if (suiteFilter === 'all' || suiteFilter === 'stress') {
    results.suites.stress = await runStressSuite(options.stressIterations || 3);
  }

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
    return results;
  }

  // Pretty terminal output
  console.log(`\n${BOLD}${CYAN}┌─────────────────────────────────────────────────────────────┐${RESET}`);
  console.log(`${BOLD}${CYAN}│${RESET}  ${BOLD}${GREEN}SextantDrift Benchmark Harness (v2.0 Evaluation Engine)${RESET}    ${BOLD}${CYAN}│${RESET}`);
  console.log(`${BOLD}${CYAN}└─────────────────────────────────────────────────────────────┘${RESET}\n`);

  for (const [name, res] of Object.entries(results.suites)) {
    if (!res.valid) {
      console.log(`${RED}✖ [${name.toUpperCase()}] FAILED: ${res.error}${RESET}\n`);
      continue;
    }

    console.log(`${BOLD}${YELLOW}► [${name.toUpperCase()} SUITE]${RESET} (${res.iterations} iterations)`);
    console.log(`  ${GRAY}• Scope:${RESET}        ${res.totalFiles || res.modules} files/modules processed`);
    console.log(`  ${GRAY}• Latency p50:${RESET}  ${BOLD}${GREEN}${res.stats.p50}ms${RESET} (mean: ${res.stats.mean}ms, σ: ±${res.stats.std}ms)`);
    console.log(`  ${GRAY}• Latency p95:${RESET}  ${res.stats.p95}ms | p99: ${res.stats.p99}ms | min: ${res.stats.min}ms | max: ${res.stats.max}ms`);
    console.log(`  ${GRAY}• Throughput:${RESET}   ${BOLD}${CYAN}${res.throughput} items/sec${RESET}`);
    if (res.suggestionCoverage !== undefined) {
      console.log(`  ${GRAY}• Suggestions:${RESET}  ${BOLD}${GREEN}${res.suggestionCoverage}%${RESET} actionable remediation coverage`);
    }
    console.log(`  ${GRAY}• Peak Heap Δ:${RESET}  ${res.peakMemDeltaMb} MB\n`);
  }

  return results;
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const suiteIdx = args.indexOf('--suite');
  const suite = suiteIdx !== -1 ? args[suiteIdx + 1] : 'all';

  runAllBenchmarks({ json: isJson, suite }).catch((err) => {
    console.error(`${RED}[Benchmark Error]${RESET}`, err);
    process.exit(1);
  });
}
