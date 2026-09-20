export type C4ContainerType = 'application' | 'service' | 'database' | 'library' | 'ui' | 'external';

export interface C4Container {
  id: string;
  name: string;
  order: number;
  technology?: string;
  description?: string;
  type?: C4ContainerType;
}

export interface Layer {
  id: string;
  name: string;
  order: number;
  technology?: string;
  description?: string;
}

export interface Component {
  id: string;
  name: string;
  layerId: string;
  containerId?: string;
  technology?: string;
  description?: string;
  paths: string[];
  forbiddenImports?: string[];
}

export interface AllowedDependency {
  from: string;
  to: string;
  protocol?: string;
  technology?: string;
  description?: string;
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

export interface C4SystemActor {
  id: string;
  name: string;
  role: 'human' | 'agent' | 'system';
  description?: string;
}

export interface C4ExternalSystem {
  id: string;
  name: string;
  description?: string;
}

export interface C4SystemContext {
  systemName: string;
  description?: string;
  actors?: C4SystemActor[];
  externalSystems?: C4ExternalSystem[];
}

export interface TargetArchitecture {
  $schema?: string;
  name?: string;
  version?: string;
  systemName?: string;
  systemContext?: C4SystemContext;
  containers?: C4Container[];
  layers: Layer[];
  components: Component[];
  allowDependencies: AllowedDependency[];
  invariants?: InvariantRule[];
  /** @deprecated Kept for backward compatibility */
  mermaid?: string;
}
