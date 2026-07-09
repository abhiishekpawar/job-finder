const PREFIX = "[job-search]";

export function log(_message: string, _data?: unknown) {
  // Intentionally silent — use logError for failures.
}

export function logError(message: string, data?: unknown) {
  if (data !== undefined) {
    console.error(`${PREFIX} ${message}`, data);
  } else {
    console.error(`${PREFIX} ${message}`);
  }
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logError(`${label} failed`, { err });
    throw err;
  }
}
