export type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
};

/**
 * Retries an async operation using exponential backoff.
 *
 * On each failure (except the last attempt) it logs a warning and waits
 * `initialDelayMs * backoffFactor^(attempt-1)` milliseconds before trying
 * again. If every attempt fails, the final error is re-thrown.
 *
 * @param label      Short human-readable description of the operation.
 * @param operation  Async function to attempt.
 * @param options    Retry configuration.
 * @returns          Resolved value of `operation` on success.
 */
export async function withRetry<T>(
  label: string,
  operation: () => Promise<T>,
  {
    maxAttempts = 5,
    initialDelayMs = 1000,
    backoffFactor = 2,
  }: RetryOptions = {},
): Promise<T> {
  let attempt = 1;
  let delay = initialDelayMs;

  while (true) {
    try {
      console.log(`${label} (attempt ${attempt}/${maxAttempts})...`);
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts) {
        console.error(`${label} failed after ${maxAttempts} attempts.`);
        throw error;
      }

      console.warn(
        `${label} failed (attempt ${attempt}/${maxAttempts}): ${
          error instanceof Error ? error.message : String(error)
        }. Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= backoffFactor;
      attempt++;
    }
  }
}

