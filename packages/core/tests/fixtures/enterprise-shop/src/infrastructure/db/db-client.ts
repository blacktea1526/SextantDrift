export interface DatabaseRow {
  id: string;
  [key: string]: any;
}

export class DatabaseClient {
  private tables: Map<string, Map<string, any>> = new Map();

  async query(table: string, id: string): Promise<any> {
    return this.tables.get(table)?.get(id) || null;
  }

  async insert(table: string, id: string, data: any): Promise<void> {
    if (!this.tables.has(table)) {
      this.tables.set(table, new Map());
    }
    this.tables.get(table)!.set(id, data);
  }
}

export const dbClient = new DatabaseClient();
