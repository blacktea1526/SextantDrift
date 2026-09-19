import { orderController } from '../controllers/order.controller.js';
import { userController } from '../controllers/user.controller.js';
import { productController } from '../controllers/product.controller.js';
import { paymentController } from '../controllers/payment.controller.js';

export const routes = {
  order: orderController,
  user: userController,
  product: productController,
  payment: paymentController,
};
