/**
 * Tujuan setelah login: `?next=` dari proxy bila berupa path internal (cegah open redirect),
 * selain itu dashboard.
 */
export function getPostLoginPath(search: string, fallback = "/dashboard"): string {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
