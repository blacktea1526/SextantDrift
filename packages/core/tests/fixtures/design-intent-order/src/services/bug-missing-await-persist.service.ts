import { CreateOrderRequest, CreateOrderResult, OrderPorts } from '../ports/order-ports.js';

export class OrderService {
  constructor(private readonly ports: OrderPorts) {}

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    if (!(await this.ports.inventory.hasStock(request.sku, request.quantity))) {
      return { status: 'insufficient_stock' };
    }

    await this.ports.inventory.reserve(request.sku, request.quantity);
    const pendingOrder = this.ports.store.createPending(request);
    await this.ports.payment.charge('optimistic-order', request.amountCents, request.idempotencyKey);
    const order = await pendingOrder;
    await this.ports.store.markPaid(order.id);
    return { status: 'paid', orderId: order.id };
  }
}
