import { QueryClient } from '@tanstack/react-query';

/**
 * Utility function to throw an error if response is not ok
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage;
    try {
      const errorJson = await res.json();
      errorMessage = errorJson.message || 'Something went wrong';
    } catch {
      errorMessage = await res.text() || 'Something went wrong';
    }
    throw new Error(errorMessage);
  }
}

/**
 * Helper function for making API requests
 */
export async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Content-Type': 'application/json',
    },
  });
  
  await throwIfResNotOk(res);
  
  if (res.status === 204) {
    return null;
  }
  
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => (
  {
    queryKey: [url, params],
  }: {
    queryKey: [string, Record<string, string | number | boolean | undefined>?];
  }
) => Promise<T> = (options) => async ({ queryKey: [url, params] }) => {
  const urlWithParams = new URL(url, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        urlWithParams.searchParams.append(key, String(value));
      }
    });
  }
  
  const res = await fetch(urlWithParams.toString());
  
  if (res.status === 401) {
    if (options.on401 === 'throw') {
      throw new Error('Unauthorized');
    }
    return null as T;
  }
  
  await throwIfResNotOk(res);
  
  if (res.status === 204) {
    return null as T;
  }
  
  return res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});