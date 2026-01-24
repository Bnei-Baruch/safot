import axios, { AxiosInstance, AxiosError } from 'axios';

console.log("From http.service: Backend URL:", process.env.REACT_APP_BACKEND_URL);

const BASE_URL = process.env.REACT_APP_BACKEND_URL;
console.log("From http.service: Backend URL:", BASE_URL);

type ErrorCallback = (message: string, details?: string) => void;

// FastAPI validation error item
interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

// Backend error response format
interface ErrorResponse {
  detail?: string | ValidationErrorItem[];
}

function formatErrorDetails(data: ErrorResponse | undefined, error: AxiosError): string | undefined {
  if (!data?.detail) {
    return error.message || undefined;
  }

  // Handle string detail (HTTPException)
  if (typeof data.detail === 'string') {
    return data.detail;
  }

  // Handle validation error array (FastAPI RequestValidationError)
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((err) => `${err.loc.join('.')}: ${err.msg}`)
      .join('\n');
  }

  return error.message || undefined;
}

class HttpService {
  private client: AxiosInstance;
  private errorCallback?: ErrorCallback;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        if (this.errorCallback) {
          const status = error.response?.status;
          const url = error.config?.url || 'unknown';
          const method = error.config?.method?.toUpperCase() || 'UNKNOWN';

          let message: string;
          if (!error.response) {
            // Network error (no response)
            message = `Network Error: ${method} ${url}`;
          } else {
            message = `HTTP ${status}: ${method} ${url}`;
          }

          const details = formatErrorDetails(error.response?.data, error);
          this.errorCallback(message, details);
        }
        return Promise.reject(error);
      }
    );
  }

  setErrorCallback(callback: ErrorCallback) {
    this.errorCallback = callback;
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  async post<T>(url: string, data: any): Promise<T> {
    const response = await this.client.post(url, data, {
      timeout: 600000,
    });
    return response.data;
  }

  async put<T>(url: string, data: any): Promise<T> {
    const response = await this.client.put(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete(url);
    return response.data;
  }

  async downloadFile(url: string): Promise<Blob> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    return response.data;
  }
}

export const httpService = new HttpService();
