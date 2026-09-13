export const APP_ORIGIN = "https://app.aprendify.cloud";

export function isAllowedPaymentReturnUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || [...value].some((char) => char.charCodeAt(0) < 0x20)) return false;
  try {
    const url = new URL(value, APP_ORIGIN);
    return url.origin === APP_ORIGIN && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Never derive payment destinations from Origin or arbitrary client URLs.
export function paymentReturnUrl(value: unknown, fallbackPath: string): string {
  const fallback = `${APP_ORIGIN}${fallbackPath}`;
  return isAllowedPaymentReturnUrl(value) ? new URL(value, APP_ORIGIN).href : fallback;
}
