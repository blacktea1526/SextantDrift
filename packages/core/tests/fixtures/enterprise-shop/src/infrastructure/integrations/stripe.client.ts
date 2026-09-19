export interface ChargeRequest {
  amount: number;
  currency: string;
  source: string;
}

export class StripeClient {
  async charge(request: ChargeRequest): Promise<{ id: string; success: boolean }> {
    return { id: 'ch_' + Math.random().toString(36).substr(2, 9), success: true };
  }
}
export const stripeClient = new StripeClient();
