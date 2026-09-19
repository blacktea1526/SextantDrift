export class NotificationClient {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // Send email notification mock
  }
}
export const notificationClient = new NotificationClient();
