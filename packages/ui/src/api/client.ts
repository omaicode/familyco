import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

export interface UIApiClientOptions {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  timeoutMs?: number;
}

export class UIApiClient {
  private readonly axios: AxiosInstance;

  constructor(options: UIApiClientOptions) {
    this.axios = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 10000
    });

    if (options.apiKey) {
      this.axios.defaults.headers.common['x-api-key'] = options.apiKey;
    }

    if (options.bearerToken) {
      this.axios.defaults.headers.common.authorization = `Bearer ${options.bearerToken}`;
    }
  }

  async get<TResponse>(path: string, config?: AxiosRequestConfig): Promise<TResponse> {
    const response = await this.axios.get<TResponse>(path, config);
    return response.data;
  }

  async post<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await this.axios.post<TResponse>(path, payload, config);
    return response.data;
  }

  async patch<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    const response = await this.axios.patch<TResponse>(path, payload, config);
    return response.data;
  }
}

export const createUIApiClient = (options: UIApiClientOptions): UIApiClient =>
  new UIApiClient(options);
