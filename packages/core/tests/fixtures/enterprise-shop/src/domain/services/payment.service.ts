import { paymentRepository } from '../../infrastructure/repositories/payment.repo.js';
import { stripeClient } from '../../infrastructure/integrations/stripe.client.js';
import { generateUUID } from '../../common/id-generator.js';

export class PaymentService {
  async processPayment(orderId: string, amount: number): Promise<{ paymentId: string; success: boolean }> {
    const paymentId = generateUUID();
    // Record payment attempt in DB first
    await paymentRepository.recordPayment({
      id: paymentId,
      orderId,
      amount,
      status: 'PENDING',
    });

    // Then invoke external stripe payment
    const chargeResult = await stripeClient.charge({
      amount,
      currency: 'USD',
      source: 'tok_visa',
    });

    return { paymentId, success: chargeResult.success };
  }
}
export const paymentService = new PaymentService();
