import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

export interface UIApiClientOptions {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export class UIApiClient {
  private readonly axios: AxiosInstance;
  private readonly retryCount: number;
  private readonly retryDelayMs: number;

  constructor(options: UIApiClientOptions) {
    this.axios = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 10000
    });

    this.retryCount = options.retryCount ?? 1;
    this.retryDelayMs = options.retryDelayMs ?? 250;

    if (options.apiKey) {
      this.axios.defaults.headers.common['x-api-key'] = options.apiKey;
    }

    if (options.bearerToken) {
      this.axios.defaults.headers.common.authorization = `Bearer ${options.bearerToken}`;
    }
  }

  async get<TResponse>(path: string, config?: AxiosRequestConfig): Promise<TResponse> {
    return this.requestWithRetry(async () => {
      const response = await this.axios.get<TResponse>(path, config);
      return response.data;
    });
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

  async delete<TResponse>(path: string, config?: AxiosRequestConfig): Promise<TResponse> {
    try {
      const response = await this.axios.delete<TResponse>(path, config);
      return response.data;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }

  private async requestWithRetry<TResponse>(request: () => Promise<TResponse>): Promise<TResponse> {
    let attempt = 0;

    while (true) {
      try {
        return await request();
      } catch (error) {
        if (!this.shouldRetry(error, attempt)) {
          throw normalizeApiError(error);
        }

        attempt += 1;
        await wait(this.retryDelayMs);
      }
    }
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.retryCount) {
      return false;
    }

    if (!axios.isAxiosError(error)) {
      return false;
    }

    if (error.code === 'ECONNABORTED') {
      return true;
    }

    if (!error.response) {
      return true;
    }

    return error.response.status >= 500;
  }
}

export const createUIApiClient = (options: UIApiClientOptions): UIApiClient =>
  new UIApiClient(options);

const wait = async (durationMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
};

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
