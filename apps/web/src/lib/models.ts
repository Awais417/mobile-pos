import { apiClient } from './api-client';

export interface Model {
  id: string;
  categoryId: string | null;
  name: string;
  // Manually-managed flag (Deactivate/Reactivate action, or auto-set on a
  // Delete attempt while products still reference it) — never derived from
  // stock. Use for the manual archive/reactivate toggle only.
  isActive: boolean;
  productCount: number;
  // Computed, response-only: true only when this model has at least one
  // active product with available stock (productCount > 0). Use this for
  // "is this model active" display/filtering — never the raw isActive flag,
  // which can legitimately stay true even after a model's stock sells out.
  displayIsActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  categoryId: string;
  name: string;
}

export interface UpdateModelInput {
  name?: string;
  isActive?: boolean;
}

export interface DeleteModelResult {
  archived: boolean;
  message: string;
}

export async function getModels(options?: {
  categoryId?: string;
  activeOnly?: boolean;
}): Promise<Model[]> {
  const params = new URLSearchParams();
  if (options?.categoryId) params.set('categoryId', options.categoryId);
  if (options?.activeOnly) params.set('active', 'true');
  const query = params.toString();
  return apiClient.get<Model[]>(`/models${query ? `?${query}` : ''}`);
}

export async function createModel(input: CreateModelInput): Promise<Model> {
  return apiClient.post<Model>('/models', input);
}

export async function updateModel(id: string, input: UpdateModelInput): Promise<Model> {
  return apiClient.patch<Model>(`/models/${id}`, input);
}

export async function deleteModel(id: string): Promise<DeleteModelResult> {
  return apiClient.del<DeleteModelResult>(`/models/${id}`);
}
