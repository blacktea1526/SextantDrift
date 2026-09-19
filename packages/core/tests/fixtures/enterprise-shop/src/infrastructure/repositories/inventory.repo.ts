import { dbClient } from '../db/db-client.js';

export class InventoryRepository {
  async getStock(productId: string): Promise<number> {
    const row = await dbClient.query('inventory', productId);
    return row?.quantity ?? 0;
  }

  async deductStock(productId: string, quantity: number): Promise<boolean> {
    const current = await this.getStock(productId);
    if (current < quantity) return false;
    await dbClient.insert('inventory', productId, { quantity: current - quantity });
    return true;
  }
}
export const inventoryRepository = new InventoryRepository();
