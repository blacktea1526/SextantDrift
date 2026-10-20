import { CreateOrderRequest, CreateOrderResult, OrderPorts } from '../ports/order-ports.js';

export class OrderService {
  constructor(private readonly ports: OrderPorts) {}

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const order = await this.ports.store.createPending(request);
    await this.ports.payment.charge(order.id, request.amountCents, request.idempotencyKey);

    if (!(await this.ports.inventory.hasStock(request.sku, request.quantity))) {
      return { status: 'insufficient_stock' };
    }

    await this.ports.inventory.reserve(request.sku, request.quantity);
    await this.ports.store.markPaid(order.id);
    return { status: 'paid', orderId: order.id };
  }
}
