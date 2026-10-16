"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { getPostLoginPath } from "@/src/features/auth/utils/redirect";

const GUEST_ONLY = ["/login", "/register"];

/** Pengguna yang sudah login diarahkan dari halaman login/daftar ke tujuan `next` atau dashboard. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && GUEST_ONLY.includes(pathname)) {
      router.replace(getPostLoginPath(window.location.search, "/dashboard?login=success"));
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  return <>{children}</>;
}
