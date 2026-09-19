import { dbClient } from '../db/db-client.js';

export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export class PaymentRepository {
  async recordPayment(payment: PaymentRecord): Promise<void> {
    await dbClient.insert('payments', payment.id, payment);
  }
}
export const paymentRepository = new PaymentRepository();
