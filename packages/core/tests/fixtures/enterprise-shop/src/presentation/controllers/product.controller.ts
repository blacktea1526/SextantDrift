import { productService } from '../../domain/services/product.service.js';

export class ProductController {
  async handleGetProduct(id: string) {
    const product = await productService.getProduct(id);
    if (!product) return { success: false, error: 'Product not found' };
    return { success: true, product };
  }
}
export const productController = new ProductController();
