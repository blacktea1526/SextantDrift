export type OrderStatus = 'pending_payment' | 'paid' | 'payment_failed';

export interface CreateOrderRequest {
  idempotencyKey: string;
  sku: string;
  quantity: number;
  amountCents: number;
}

export interface OrderRecord {
  id: string;
  idempotencyKey: string;
  sku: string;
  quantity: number;
  amountCents: number;
  status: OrderStatus;
}

export type CreateOrderResult =
  | { status: 'insufficient_stock' }
  | { status: 'payment_failed'; orderId: string }
  | { status: 'paid'; orderId: string };

export interface InventoryPort {
  hasStock(sku: string, quantity: number): Promise<boolean>;
  reserve(sku: string, quantity: number): Promise<void>;
  release(sku: string, quantity: number): Promise<void>;
}

export interface OrderStorePort {
  findByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | undefined>;
  createPending(request: CreateOrderRequest): Promise<OrderRecord>;
  markPaid(orderId: string): Promise<OrderRecord>;
  markPaymentFailed(orderId: string): Promise<OrderRecord>;
}

export interface PaymentPort {
  charge(orderId: string, amountCents: number, idempotencyKey: string): Promise<void>;
}

export interface OrderPorts {
  inventory: InventoryPort;
  store: OrderStorePort;
  payment: PaymentPort;
}
