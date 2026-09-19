import { dbClient } from '../db/db-client.js';

export interface OrderRecord {
  id: string;
  userId: string;
  totalAmount: number;
  status: string;
}

export class OrderRepository {
  async findById(id: string): Promise<OrderRecord | null> {
    return dbClient.query('orders', id);
  }

  async save(order: OrderRecord): Promise<void> {
    await dbClient.insert('orders', order.id, order);
  }
}
export const orderRepository = new OrderRepository();
