import { User } from '../entities/user.entity.js';
import { userRepository } from '../../infrastructure/repositories/user.repo.js';
import { generateUUID } from '../../common/id-generator.js';

export class UserService {
  async register(email: string, name: string): Promise<User> {
    const user = new User(generateUUID(), email, name);
    await userRepository.save(user);
    return user;
  }

  async getProfile(id: string): Promise<User | null> {
    const record = await userRepository.findById(id);
    if (!record) return null;
    return new User(record.id, record.email, record.name);
  }
}
export const userService = new UserService();
