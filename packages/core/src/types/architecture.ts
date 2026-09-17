export interface Layer {
  id: string;
  name: string;
  order: number;
  description?: string;
}

export interface Component {
  id: string;
  name: string;
  layerId: string;
  paths: string[];
  forbiddenImports?: string[];
  description?: string;
}

export interface AllowedDependency {
  from: string;
  to: string;
}

export interface InvariantPattern {
  must_precede?: string[];
  target?: string[];
  scope?: string;
  forbid_import?: string[];
  in_path?: string;
  require_config?: string[];
}

export interface InvariantRule {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  desc: string;
  pattern: InvariantPattern;
}

export interface TargetArchitecture {
  $schema?: string;
  name?: string;
  version?: string;
  layers: Layer[];
  components: Component[];
  allowDependencies: AllowedDependency[];
  invariants?: InvariantRule[];
  mermaid?: string;
}
