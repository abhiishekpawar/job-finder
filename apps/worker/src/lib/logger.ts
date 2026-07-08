export const logger = {
  info(message: string, payload?: unknown) {
    console.log(`[worker] ${message}`, payload ?? "");
  },
  error(message: string, payload?: unknown) {
    console.error(`[worker] ${message}`, payload ?? "");
  }
};
