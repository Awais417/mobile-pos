import { apiClient } from './api-client';

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  costPrice: string;
  salePrice: string;
  stockQty: number;
  reorderLevel: number;
  isActive: boolean;
  categoryId: string | null;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  barcode?: string;
  costPrice: number;
  salePrice: number;
  stockQty?: number;
  reorderLevel?: number;
  categoryId?: string;
}

export interface UpdateProductInput {
  name?: string;
  barcode?: string;
  costPrice?: number;
  salePrice?: number;
  stockQty?: number;
  reorderLevel?: number;
  categoryId?: string;
}

export async function getProducts(): Promise<Product[]> {
  return apiClient.get<Product[]>('/products');
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  return apiClient.post<Product>('/products', input);
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<Product> {
  return apiClient.patch<Product>(`/products/${id}`, input);
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.del(`/products/${id}`);
}