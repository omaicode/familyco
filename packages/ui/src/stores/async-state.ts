import { reactive } from 'vue';

export interface AsyncState<TData> {
  isLoading: boolean;
  isEmpty: boolean;
  errorMessage: string | null;
  data: TData;
}

export const createAsyncState = <TData>(initialData: TData): AsyncState<TData> =>
  reactive({
    isLoading: false,
    isEmpty: false,
    errorMessage: null,
    data: initialData
  }) as AsyncState<TData>;
