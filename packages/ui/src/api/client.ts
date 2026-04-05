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
    try {
      const response = await this.axios.get<TResponse>(path, config);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }

  async post<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    try {
      const response = await this.axios.post<TResponse>(path, payload, config);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }

  async patch<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    config?: AxiosRequestConfig
  ): Promise<TResponse> {
    try {
      const response = await this.axios.patch<TResponse>(path, payload, config);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }
}

export const createUIApiClient = (options: UIApiClientOptions): UIApiClient =>
  new UIApiClient(options);

function normalizeApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | {
          code?: string;
          message?: string;
          statusCode?: number;
        }
      | undefined;

    const code = payload?.code ?? 'API_ERROR';
    const message = payload?.message ?? error.message;
    const statusCode = payload?.statusCode ?? error.response?.status;
    return new Error(statusCode ? `${code}:${statusCode}:${message}` : `${code}:${message}`);
  }

  return error instanceof Error ? error : new Error('API_ERROR:Unknown error');
}
