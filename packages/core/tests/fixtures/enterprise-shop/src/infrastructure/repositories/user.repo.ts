import { dbClient } from '../db/db-client.js';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
}

export class UserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    return dbClient.query('users', id);
  }

  async save(user: UserRecord): Promise<void> {
    await dbClient.insert('users', user.id, user);
  }
}
export const userRepository = new UserRepository();
