export interface AsyncState<TData> {
  isLoading: boolean;
  isEmpty: boolean;
  errorMessage: string | null;
  data: TData;
}

export const createAsyncState = <TData>(initialData: TData): AsyncState<TData> => ({
  isLoading: false,
  isEmpty: false,
  errorMessage: null,
  data: initialData
});
