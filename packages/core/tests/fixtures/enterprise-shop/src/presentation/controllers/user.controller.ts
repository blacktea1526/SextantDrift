import { userService } from '../../domain/services/user.service.js';
import { RegisterUserDto } from '../dto/user.dto.js';

export class UserController {
  async handleRegister(dto: RegisterUserDto) {
    const user = await userService.register(dto.email, dto.name);
    return { success: true, user };
  }

  async handleProfile(id: string) {
    const user = await userService.getProfile(id);
    if (!user) return { success: false, error: 'User not found' };
    return { success: true, user };
  }
}
export const userController = new UserController();
