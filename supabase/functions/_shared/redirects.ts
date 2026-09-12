export const APP_ORIGIN = "https://app.aprendify.cloud";

// Never derive payment destinations from Origin or arbitrary client URLs.
export function paymentReturnUrl(value: unknown, fallbackPath: string): string {
  const fallback = `${APP_ORIGIN}${fallbackPath}`;
  if (typeof value !== "string" || !value || /[\\\x00-\x20]/.test(value)) return fallback;
  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN || url.username || url.password) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}
