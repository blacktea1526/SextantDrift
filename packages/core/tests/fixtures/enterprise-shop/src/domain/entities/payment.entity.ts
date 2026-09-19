export class Payment {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly amount: number,
    public status: 'PENDING' | 'SUCCESS' | 'FAILED'
  ) {}
}
