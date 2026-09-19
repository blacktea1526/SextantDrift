export interface CreateOrderDto {
  userId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}
