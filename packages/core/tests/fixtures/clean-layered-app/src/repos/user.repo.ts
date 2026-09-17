import { formatCurrency } from '../utils/format.js';

export class UserRepo {
  findUserById(id: string) {
    return { id, balance: formatCurrency(100) };
  }
}
