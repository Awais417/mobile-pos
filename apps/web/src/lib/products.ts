import { apiClient } from './api-client';
import { tokenStorage } from './token-storage';

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
}

export interface CreateProductInput {
  name: string;
  sku: string;
  costPrice: number;
  salePrice: number;
  stockQty?: number;
  reorderLevel?: number;
}

function authHeader() {
  const token = tokenStorage.getAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function getProducts(): Promise<Product[]> {
  return apiClient.get<Product[]>('/products', { headers: authHeader() });
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  return apiClient.post<Product>('/products', input, { headers: authHeader() });
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.del(`/products/${id}`, { headers: authHeader() });
}