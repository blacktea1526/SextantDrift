import { Product } from '../entities/product.entity.js';
import { productRepository } from '../../infrastructure/repositories/product.repo.js';

export class ProductService {
  async getProduct(id: string): Promise<Product | null> {
    const record = await productRepository.findById(id);
    if (!record) return null;
    return new Product(record.id, record.name, record.price);
  }
}
export const productService = new ProductService();
