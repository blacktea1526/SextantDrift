import { Order, OrderItem } from '../entities/order.entity.js';
import { orderRepository } from '../../infrastructure/repositories/order.repo.js';
import { inventoryRepository } from '../../infrastructure/repositories/inventory.repo.js';
import { orderStateMachine } from '../state/order-state.js';
import { logger } from '../../common/logger.js';
import { generateUUID } from '../../common/id-generator.js';

export class OrderService {
  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    logger.info(`Creating order for user ${userId}`);
    const id = generateUUID();
    const order = new Order(id, userId, items, 'CREATED');

    for (const item of items) {
      const stockOk = await inventoryRepository.deductStock(item.productId, item.quantity);
      if (!stockOk) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    await orderRepository.save({
      id: order.id,
      userId: order.userId,
      totalAmount: order.calculateTotal(),
      status: order.status,
    });

    return order;
  }

  async getOrder(id: string): Promise<Order | null> {
    const record = await orderRepository.findById(id);
    if (!record) return null;
    return new Order(record.id, record.userId, [], record.status as any);
  }
}
export const orderService = new OrderService();
