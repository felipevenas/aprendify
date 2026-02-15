/**
 * Lazy-loads the MercadoPago checkout script on demand.
 * Call this only on pages that need it (e.g., Subscription).
 */
export function loadMercadoPago() {
  if ((window as any).$MPC_loaded) return;

  const s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = document.location.protocol + "//secure.mlstatic.com/mptools/render.js";
  const x = document.getElementsByTagName("script")[0];
  x?.parentNode?.insertBefore(s, x);
  (window as any).$MPC_loaded = true;
}
