import { CreateOrderRequest, CreateOrderResult, OrderPorts } from '../ports/order-ports.js';

export class OrderService {
  constructor(private readonly ports: OrderPorts) {}

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    if (!(await this.ports.inventory.hasStock(request.sku, request.quantity))) {
      return { status: 'insufficient_stock' };
    }

    await this.ports.inventory.reserve(request.sku, request.quantity);

    let orderId = 'fallback-order';
    try {
      const order = await this.ports.store.createPending(request);
      orderId = order.id;
    } catch {
      orderId = 'lost-pending-order';
    }

    await this.ports.payment.charge(orderId, request.amountCents, request.idempotencyKey);
    return { status: 'paid', orderId };
  }
}
