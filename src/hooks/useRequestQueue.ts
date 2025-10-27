import { useCallback, useRef } from 'react';

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

/**
 * Hook to manage a queue of async requests with concurrency limit
 * Prevents too many simultaneous blockchain calls
 */
export const useRequestQueue = (maxConcurrent: number = 3) => {
  const queueRef = useRef<QueuedRequest<any>[]>([]);
  const activeRef = useRef<number>(0);

  const processQueue = useCallback(() => {
    if (activeRef.current >= maxConcurrent || queueRef.current.length === 0) {
      return;
    }

    const request = queueRef.current.shift();
    if (!request) return;

    activeRef.current++;

    request
      .fn()
      .then((result) => {
        request.resolve(result);
      })
      .catch((error) => {
        request.reject(error);
      })
      .finally(() => {
        activeRef.current--;
        // Process next item in queue
        setTimeout(() => processQueue(), 100); // Small delay between requests
      });

    // Process additional concurrent requests
    if (activeRef.current < maxConcurrent) {
      processQueue();
    }
  }, [maxConcurrent]);

  const enqueue = useCallback(
    <T,>(fn: () => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        queueRef.current.push({ fn, resolve, reject });
        processQueue();
      });
    },
    [processQueue]
  );

  return { enqueue };
};
