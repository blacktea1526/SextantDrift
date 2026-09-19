import { dbClient } from '../db/db-client.js';

export interface ProductRecord {
  id: string;
  name: string;
  price: number;
}

export class ProductRepository {
  async findById(id: string): Promise<ProductRecord | null> {
    return dbClient.query('products', id);
  }

  async save(product: ProductRecord): Promise<void> {
    await dbClient.insert('products', product.id, product);
  }
}
export const productRepository = new ProductRepository();
