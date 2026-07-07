import { apiClient } from './api-client';

export interface Category {
  id: string;
  name: string;
}

export async function getCategories(): Promise<Category[]> {
  return apiClient.get<Category[]>('/categories');
}

export async function createCategory(name: string): Promise<Category> {
  return apiClient.post<Category>('/categories', { name });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.del(`/categories/${id}`);
}