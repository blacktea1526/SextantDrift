export interface Edge<TEdge = unknown> {
  from: string;
  to: string;
  metadata?: TEdge;
}

export class DirectedGraph<TNode = unknown, TEdge = unknown> {
  private nodes: Map<string, TNode | undefined> = new Map();
  private outgoing: Map<string, Map<string, TEdge | undefined>> = new Map();
  private outgoingList: Map<string, string[]> = new Map();
  private incoming: Map<string, Map<string, TEdge | undefined>> = new Map();
  private incomingList: Map<string, string[]> = new Map();

  addNode(id: string, metadata?: TNode): this {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, metadata);
      this.outgoing.set(id, new Map());
      this.outgoingList.set(id, []);
      this.incoming.set(id, new Map());
      this.incomingList.set(id, []);
    } else if (metadata !== undefined) {
      this.nodes.set(id, metadata);
    }
    return this;
  }

  addEdge(from: string, to: string, metadata?: TEdge): this {
    this.addNode(from);
    this.addNode(to);

    const outMap = this.outgoing.get(from)!;
    if (!outMap.has(to)) {
      this.outgoingList.get(from)!.push(to);
    }
    outMap.set(to, metadata);

    const inMap = this.incoming.get(to)!;
    if (!inMap.has(from)) {
      this.incomingList.get(to)!.push(from);
    }
    inMap.set(from, metadata);

    return this;
  }

  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  hasEdge(from: string, to: string): boolean {
    return this.outgoing.get(from)?.has(to) ?? false;
  }

  getNode(id: string): TNode | undefined {
    return this.nodes.get(id);
  }

  getNodes(): string[] {
    return Array.from(this.nodes.keys());
  }

  getSuccessors(id: string): string[] {
    return this.outgoingList.get(id) ?? [];
  }

  getPredecessors(id: string): string[] {
    return this.incomingList.get(id) ?? [];
  }

  getOutDegree(id: string): number {
    return this.outgoing.get(id)?.size ?? 0;
  }

  getInDegree(id: string): number {
    return this.incoming.get(id)?.size ?? 0;
  }

  getEdgeMetadata(from: string, to: string): TEdge | undefined {
    return this.outgoing.get(from)?.get(to);
  }

  getEdges(): Edge<TEdge>[] {
    const edges: Edge<TEdge>[] = [];
    for (const [from, targets] of this.outgoing.entries()) {
      for (const [to, metadata] of targets.entries()) {
        edges.push({ from, to, metadata });
      }
    }
    return edges;
  }
}
