export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export class Order {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public items: OrderItem[],
    public status: 'CREATED' | 'PAID' | 'SHIPPED' | 'CANCELLED' = 'CREATED'
  ) {}

  calculateTotal(): number {
    return this.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }
}
