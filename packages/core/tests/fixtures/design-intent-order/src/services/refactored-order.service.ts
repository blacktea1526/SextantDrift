import { CreateOrderRequest, CreateOrderResult, OrderPorts } from '../ports/order-ports.js';

export class OrderService {
  private readonly activeKeys = new Map<string, Promise<CreateOrderResult>>();

  constructor(private readonly ports: OrderPorts) {}

  createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const active = this.activeKeys.get(request.idempotencyKey);
    if (active) return active;

    const promise = this.process(request);
    this.activeKeys.set(request.idempotencyKey, promise);
    void promise.finally(() => this.activeKeys.delete(request.idempotencyKey)).catch(() => undefined);
    return promise;
  }

  private async process(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const reusable = await this.ports.store.findByIdempotencyKey(request.idempotencyKey);
    if (reusable?.status === 'paid') return { status: 'paid', orderId: reusable.id };

    if (!(await this.ports.inventory.hasStock(request.sku, request.quantity))) {
      return { status: 'insufficient_stock' };
    }

    await this.ports.inventory.reserve(request.sku, request.quantity);
    const pending = await this.ports.store.createPending(request);
    return this.chargeAndPersist(request, pending.id);
  }

  private async chargeAndPersist(request: CreateOrderRequest, orderId: string): Promise<CreateOrderResult> {
    try {
      await this.ports.payment.charge(orderId, request.amountCents, request.idempotencyKey);
      await this.ports.store.markPaid(orderId);
      return { status: 'paid', orderId };
    } catch {
      await this.ports.inventory.release(request.sku, request.quantity);
      await this.ports.store.markPaymentFailed(orderId);
      return { status: 'payment_failed', orderId };
    }
  }
}
