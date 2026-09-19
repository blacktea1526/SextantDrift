export type OrderStatus = 'CREATED' | 'PAID' | 'SHIPPED' | 'CANCELLED';

export class OrderStateMachine {
  private allowedTransitions: Map<OrderStatus, OrderStatus[]> = new Map([
    ['CREATED', ['PAID', 'CANCELLED']],
    ['PAID', ['SHIPPED', 'CANCELLED']],
    ['SHIPPED', []],
    ['CANCELLED', []],
  ]);

  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const nextList = this.allowedTransitions.get(from) || [];
    return nextList.includes(to);
  }
}
export const orderStateMachine = new OrderStateMachine();
