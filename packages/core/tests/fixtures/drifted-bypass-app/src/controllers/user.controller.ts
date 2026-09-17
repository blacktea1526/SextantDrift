import { PrismaClient } from '@prisma/client';
import { UserRepo } from '../repos/user.repo.js';

export class UserController {
  private prisma = new PrismaClient();
  private repo = new UserRepo();

  handle() {
    return this.repo.findUser();
  }
}
