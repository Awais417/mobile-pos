import { config } from './config';

// API se aane wale error ka shape (backend ke exception filter jaisa).
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

// Custom error class — taake catch mein hum API errors pehchan sakein.
export class ApiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Generic request function — saari API calls iske through jati hain.
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Agar response khali hai (jaise 204), to seedha return
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  // Agar backend ne error status diya (4xx/5xx)
  if (!response.ok) {
    const apiError = data as ApiError | null;
    throw new ApiRequestError(
      response.status,
      apiError?.message ?? 'Something went wrong. Please try again.',
    );
  }

  return data as T;
}

// Reusable client — har jagah isko use karenge.
export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  del: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};