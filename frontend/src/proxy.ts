import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Harus sama dengan SESSION_COOKIE di AuthProvider
const SESSION_COOKIE = "slpm_session";
const PROTECTED = /^\/(dashboard|workspace|admin|profile)(\/|$)/;

/**
 * Proxy (Next.js 16, sebelumnya "middleware"): deteksi locale + pengalihan awal seperti MANGO.
 * Tamu tanpa penanda sesi langsung diarahkan ke /login. Validasi token yang sebenarnya tetap
 * di klien (DashboardLayoutWrapper), karena access token ada di memori dan refresh token
 * berupa cookie HttpOnly milik backend.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, maybeLocale, ...rest] = pathname.split("/");
  const hasLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  const path = hasLocale ? `/${rest.join("/")}` : pathname;

  if (hasLocale && PROTECTED.test(path) && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL(`/${maybeLocale}/login`, request.url);
    url.searchParams.set("next", `${path}${search}`);
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.svg|images|models|.*\\..*).*)",
  ],
};
