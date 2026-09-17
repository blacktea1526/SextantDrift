import { UserService } from '@/services/user.service.js';

export class UserController {
  private service = new UserService();

  handle(id: string) {
    return this.service.getUser(id);
  }
}
