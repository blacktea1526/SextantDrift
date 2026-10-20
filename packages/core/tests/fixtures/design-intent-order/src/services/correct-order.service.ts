import { CreateOrderRequest, CreateOrderResult, OrderPorts } from '../ports/order-ports.js';

export class OrderService {
  private readonly inFlight = new Map<string, Promise<CreateOrderResult>>();

  constructor(private readonly ports: OrderPorts) {}

  createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const pending = this.inFlight.get(request.idempotencyKey);
    if (pending) return pending;

    const run = this.createOrderOnce(request).finally(() => {
      this.inFlight.delete(request.idempotencyKey);
    });
    this.inFlight.set(request.idempotencyKey, run);
    return run;
  }

  private async createOrderOnce(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const existing = await this.ports.store.findByIdempotencyKey(request.idempotencyKey);
    if (existing?.status === 'paid') {
      return { status: 'paid', orderId: existing.id };
    }

    const hasStock = await this.ports.inventory.hasStock(request.sku, request.quantity);
    if (!hasStock) {
      return { status: 'insufficient_stock' };
    }

    await this.ports.inventory.reserve(request.sku, request.quantity);
    const order = await this.ports.store.createPending(request);

    try {
      await this.ports.payment.charge(order.id, request.amountCents, request.idempotencyKey);
      const paid = await this.ports.store.markPaid(order.id);
      return { status: 'paid', orderId: paid.id };
    } catch {
      await this.ports.inventory.release(request.sku, request.quantity);
      const failed = await this.ports.store.markPaymentFailed(order.id);
      return { status: 'payment_failed', orderId: failed.id };
    }
  }
}
