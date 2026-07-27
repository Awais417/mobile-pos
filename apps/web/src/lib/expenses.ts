import { apiClient } from './api-client';

export interface Expense {
  id: string;
  amount: string;
  title: string;
  note: string | null;
  date: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface CreateExpenseInput {
  amount: number;
  title: string;
  date: string;
  note?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface ExpensePeriodSummary {
  sales: string;
  expenses: string;
  net: string;
}

export interface ExpensesSummary {
  today: ExpensePeriodSummary;
  weekly: ExpensePeriodSummary;
  monthly: ExpensePeriodSummary;
  overall: ExpensePeriodSummary;
}

export async function getExpenses(): Promise<Expense[]> {
  return apiClient.get<Expense[]>('/expenses');
}

export async function getExpensesSummary(): Promise<ExpensesSummary> {
  return apiClient.get<ExpensesSummary>('/expenses/summary');
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  return apiClient.post<Expense>('/expenses', input);
}

export async function updateExpense(id: string, input: UpdateExpenseInput): Promise<Expense> {
  return apiClient.patch<Expense>(`/expenses/${id}`, input);
}

export async function deleteExpense(id: string): Promise<{ message: string }> {
  return apiClient.del<{ message: string }>(`/expenses/${id}`);
}
