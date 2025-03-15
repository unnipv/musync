/**
 * Handles API requests with error handling and response parsing
 * @param url - The URL to fetch
 * @param options - The fetch options
 * @returns A promise that resolves to the parsed response data
 */
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'An error occurred');
    }

    return data as T;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Makes a GET request to the API
 * @param url - The URL to fetch
 * @returns A promise that resolves to the parsed response data
 */
export function get<T>(url: string): Promise<T> {
  return fetchApi<T>(url, { method: 'GET' });
}

/**
 * Makes a POST request to the API
 * @param url - The URL to fetch
 * @param data - The data to send
 * @returns A promise that resolves to the parsed response data
 */
export function post<T>(url: string, data: any): Promise<T> {
  return fetchApi<T>(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Makes a PUT request to the API
 * @param url - The URL to fetch
 * @param data - The data to send
 * @returns A promise that resolves to the parsed response data
 */
export function put<T>(url: string, data: any): Promise<T> {
  return fetchApi<T>(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Makes a DELETE request to the API
 * @param url - The URL to fetch
 * @param data - Optional data to send
 * @returns A promise that resolves to the parsed response data
 */
export function del<T>(url: string, data?: any): Promise<T> {
  const options: RequestInit = {
    method: 'DELETE',
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  return fetchApi<T>(url, options);
} 