import { orderService } from '../../domain/services/order.service.js';
import { CreateOrderDto } from '../dto/order.dto.js';
import { logger } from '../../common/logger.js';

export class OrderController {
  async handleCreateOrder(dto: CreateOrderDto) {
    logger.info(`Received create order request for user ${dto.userId}`);
    const order = await orderService.createOrder(dto.userId, dto.items);
    return { success: true, orderId: order.id, status: order.status };
  }

  async handleGetOrder(id: string) {
    const order = await orderService.getOrder(id);
    if (!order) return { success: false, error: 'Not found' };
    return { success: true, order };
  }
}
export const orderController = new OrderController();
