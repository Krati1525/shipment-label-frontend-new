/**
 * Central API client for ShipmentFlow.
 * Uses native fetch and reads base URL from NEXT_PUBLIC_API_BASE_URL.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export class ApiError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers = {}, ...customConfig } = options;

  // Build query string if parameters provided
  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const isFormData = customConfig.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...customConfig,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
    });
  } catch (err: unknown) {
    throw new ApiError(
      'Unable to connect to the server. Please make sure the backend is running.',
      0,
      err
    );
  }

  if (!response.ok) {
    let errorData: unknown = null;
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      errorData = await response.json();
      if (
        errorData &&
        typeof errorData === 'object' &&
        'message' in errorData
      ) {
        const msg = (errorData as { message: unknown }).message;
        if (typeof msg === 'string') {
          errorMessage = msg;
        } else if (Array.isArray(msg)) {
          errorMessage = msg.map(String).join(', ');
        }
      }
    } catch {
      // response was not JSON
    }
    throw new ApiError(errorMessage, response.status, errorData);
  }

  // If 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(
    endpoint: string,
    params?: RequestOptions['params'],
    headers?: HeadersInit,
    signal?: AbortSignal
  ) =>
    request<T>(endpoint, { method: 'GET', params, headers, signal }),

  post: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    }),

  put: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    }),

  patch: <T>(endpoint: string, body?: unknown, headers?: HeadersInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    }),

  delete: <T>(endpoint: string, headers?: HeadersInit) =>
    request<T>(endpoint, { method: 'DELETE', headers }),

  getBaseUrl: () => API_BASE_URL,
};

export default apiClient;
