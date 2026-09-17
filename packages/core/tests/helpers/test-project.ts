import ts from 'typescript';

export interface VirtualFileMap {
  [filePath: string]: string;
}

export class VirtualProject {
  private files: Map<string, string> = new Map();

  constructor(initialFiles: VirtualFileMap = {}) {
    for (const [path, content] of Object.entries(initialFiles)) {
      this.files.set(path, content);
    }
  }

  setFile(path: string, content: string): this {
    this.files.set(path, content);
    return this;
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  getAllFiles(): Array<{ path: string; content: string }> {
    return Array.from(this.files.entries()).map(([path, content]) => ({ path, content }));
  }

  getSourceFile(path: string): ts.SourceFile | undefined {
    const content = this.files.get(path);
    if (content === undefined) return undefined;
    return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  }
}
