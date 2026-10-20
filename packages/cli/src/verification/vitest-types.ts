export interface TaskErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

export interface WorkerTaskArtifact {
  runId: string;
  checkId: string;
  scenarioId: string;
  testFile: string;
  testName: string;
  state: string;
  mode?: string;
  retry: number;
  repeats: number;
  fails: boolean;
  retryCount: number;
  repeatCount: number;
  errors: TaskErrorInfo[];
  location?: { file: string; line: number };
  duration?: number;
  timestamp: number;
}

export interface InventoryItem {
  testFile: string;
  taskName: string;
  fullNameArrow: string;
  fullNameSpace: string;
  mode?: string;
  state?: string;
}

export interface EndMarkerArtifact {
  runId: string;
  inventory: InventoryItem[];
  errors: string[];
  finishedAt: number;
}
