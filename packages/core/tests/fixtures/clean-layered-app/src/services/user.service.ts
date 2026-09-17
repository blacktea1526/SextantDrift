import { UserRepo } from '../repos/user.repo.js';

export class UserService {
  private repo = new UserRepo();

  getUser(id: string) {
    return this.repo.findUserById(id);
  }
}
