export async function measure<T>(label: string, fn: () => PromiseLike<T> | T): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const ms = Date.now() - start;
    console.log(`[perf] ${label}: ${ms}ms`);
  }
}
