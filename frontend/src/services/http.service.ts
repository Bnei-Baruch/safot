import axios, { AxiosInstance } from 'axios';

console.log("From http.service: Backend URL:", process.env.REACT_APP_BACKEND_URL);

const BASE_URL = process.env.REACT_APP_BACKEND_URL;
console.log("From http.service: Backend URL:", BASE_URL);

class HttpService {
  private client: AxiosInstance;

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
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get(url, { params });
    return response.data;
  }

  async post<T>(url: string, data: any): Promise<T> {
    console.log('POST', url, data);
    const response = await this.client.post(url, data, {
      timeout: 600000,
    });
    console.log('POST', response);
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
