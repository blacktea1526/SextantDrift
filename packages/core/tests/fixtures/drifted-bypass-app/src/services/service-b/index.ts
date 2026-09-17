import { helperA } from '../service-a/index.js';
import { UserController } from '../../controllers/user.controller.js';

export function helperB() {
  const ctrl = new UserController();
  return { a: helperA(), ctrl };
}
