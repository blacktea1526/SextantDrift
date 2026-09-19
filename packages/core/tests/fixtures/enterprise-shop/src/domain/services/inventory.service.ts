import { inventoryRepository } from '../../infrastructure/repositories/inventory.repo.js';

export class InventoryService {
  async checkAvailability(productId: string): Promise<boolean> {
    const stock = await inventoryRepository.getStock(productId);
    return stock > 0;
  }
}
export const inventoryService = new InventoryService();
