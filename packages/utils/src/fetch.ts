/**
 * Executes a fetch request with a configurable timeout.
 *
 * This function wraps the native fetch API with automatic timeout handling using AbortController.
 * If the request doesn't complete within the specified timeout period, it will be aborted and
 * an error will be thrown.
 *
 * @param url - The URL to fetch from
 * @param timeout - Maximum time to wait for the request in milliseconds
 * @param options - Optional fetch configuration (headers, method, body, etc.)
 *
 * @returns A Promise that resolves to the Response object
 *
 * @throws {Error} Throws "Request timed out" if the timeout is exceeded
 * @throws {Error} Re-throws any other fetch errors (network errors, etc.)
 *
 * @example
 * ```typescript
 * // Basic GET request with 5 second timeout
 * const response = await fetchWithTimeout('https://api.example.com/data', 5000);
 *
 * // POST request with timeout
 * const response = await fetchWithTimeout(
 *   'https://api.example.com/create',
 *   10000,
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ name: 'example' })
 *   }
 * );
 * ```
 */
export const fetchWithTimeout = async (
  url: string,
  timeout: number,
  options?: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
