const PREFIX = "[job-search]";

export function log(message: string, data?: unknown) {
  if (data !== undefined) {
    console.log(`${PREFIX} ${message}`, data);
  } else {
    console.log(`${PREFIX} ${message}`);
  }
}

export function logError(message: string, data?: unknown) {
  if (data !== undefined) {
    console.error(`${PREFIX} ${message}`, data);
  } else {
    console.error(`${PREFIX} ${message}`);
  }
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  log(`${label} started`);
  try {
    const result = await fn();
    log(`${label} finished`, { ms: Date.now() - start });
    return result;
  } catch (err) {
    logError(`${label} failed`, { ms: Date.now() - start, err });
    throw err;
  }
}
