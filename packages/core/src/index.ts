import { AnalyzeOptions, DriftReport } from './types/report.js';
import { executeModuleDriftPipeline } from './pipeline/module-drift-pipeline.js';

export const VERSION = '2.0.3';

export * from './types/index.js';
export * from './errors/config-error.js';
export * from './parser/json-spec-parser.js';
export * from './parser/mermaid-adapter.js';
export * from './parser/mermaid-generator.js';
export * from './parser/spec-resolver.js';
export * from './analyzer/file-scanner.js';
export * from './analyzer/ast-extractor.js';
export * from './analyzer/python-ast-extractor.js';
export * from './analyzer/go-ast-extractor.js';
export * from './analyzer/path-resolver.js';
export * from './analyzer/python-resolver.js';
export * from './analyzer/go-resolver.js';
export * from './analyzer/source-language.js';
export {
  resolveModuleWithTsCompiler,
  clearTsResolverCache,
  findNearestTsConfigFile,
  getParsedTsConfig,
} from './analyzer/ts-project-resolver.js';
export * from './analyzer/barrel-tracer.js';
export * from './pipeline/actual-graph-builder.js';
export * from './file-checker.js';
export * from './analyzer/noise-filter.js';
export * from './graph/directed-graph.js';
export * from './graph/tarjan.js';
export * from './comparator/bypass-detector.js';
export * from './comparator/inversion-detector.js';
export * from './invariants/parser.js';
export * from './invariants/sequence-matcher.js';
export * from './invariants/import-matcher.js';
export * from './invariants/config-matcher.js';
export * from './invariants/engine.js';
export * from './baseline/fingerprint.js';
export * from './baseline/manager.js';
export * from './state/index.js';
export * from './trace/index.js';
export * from './causality/index.js';
export * from './contract/index.js';
export * from './c4/index.js';
export * from './pipeline/module-drift-pipeline.js';
export * from './acceptance/types.js';
export * from './acceptance/versions.js';
export * from './acceptance/config.js';
export * from './acceptance/evaluate.js';
export * from './requirements/index.js';

/**
 * Main Pure Analysis Entrypoint.
 * Evaluates target architecture against physical codebase, returning DriftReport.
 */
export async function analyzeModuleDrift(options: AnalyzeOptions): Promise<DriftReport> {
  return executeModuleDriftPipeline(options);
}
