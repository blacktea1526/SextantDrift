import { paymentService } from '../../domain/services/payment.service.js';
import { ProcessPaymentDto } from '../dto/payment.dto.js';

export class PaymentController {
  async handlePayment(dto: ProcessPaymentDto) {
    const result = await paymentService.processPayment(dto.orderId, dto.amount);
    return { success: result.success, paymentId: result.paymentId };
  }
}
export const paymentController = new PaymentController();
