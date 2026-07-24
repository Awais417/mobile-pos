import { apiClient } from './api-client';

export interface Category {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  isActive: boolean;
  isSerialized: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  slug?: string;
  isSerialized?: boolean;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput> & {
  isActive?: boolean;
};

export interface DeleteCategoryResult {
  message: string;
}

export async function getCategories(options?: { activeOnly?: boolean }): Promise<Category[]> {
  const query = options?.activeOnly ? '?active=true' : '';
  return apiClient.get<Category[]>(`/categories${query}`);
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return apiClient.post<Category>('/categories', input);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  return apiClient.patch<Category>(`/categories/${id}`, input);
}

export async function deleteCategory(id: string): Promise<DeleteCategoryResult> {
  return apiClient.del<DeleteCategoryResult>(`/categories/${id}`);
}
