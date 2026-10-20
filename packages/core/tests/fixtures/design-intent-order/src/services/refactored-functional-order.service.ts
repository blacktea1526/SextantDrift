import { CreateOrderRequest, CreateOrderResult, OrderPorts } from '../ports/order-ports.js';

export class OrderService {
  private readonly requestsByKey = new Map<string, Promise<CreateOrderResult>>();

  constructor(private readonly ports: OrderPorts) {}

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const known = await this.ports.store.findByIdempotencyKey(request.idempotencyKey);
    if (known?.status === 'paid') return { status: 'paid', orderId: known.id };

    const current = this.requestsByKey.get(request.idempotencyKey);
    if (current) return current;

    const created = this.createNewOrder(request);
    this.requestsByKey.set(request.idempotencyKey, created);
    void created.finally(() => this.requestsByKey.delete(request.idempotencyKey)).catch(() => undefined);
    return created;
  }

  private async createNewOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    if (!(await this.ports.inventory.hasStock(request.sku, request.quantity))) {
      return { status: 'insufficient_stock' };
    }

    await this.ports.inventory.reserve(request.sku, request.quantity);
    const order = await this.ports.store.createPending(request);

    try {
      await this.ports.payment.charge(order.id, request.amountCents, request.idempotencyKey);
      await this.ports.store.markPaid(order.id);
      return { status: 'paid', orderId: order.id };
    } catch {
      await this.ports.inventory.release(request.sku, request.quantity);
      await this.ports.store.markPaymentFailed(order.id);
      return { status: 'payment_failed', orderId: order.id };
    }
  }
}
