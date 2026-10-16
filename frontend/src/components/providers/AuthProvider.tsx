"use client";

import Cookies from "js-cookie";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, refreshAccessToken, setUnauthorizedHandler, tokenStore, getErrorMessage } from "@/src/lib/http/axios";
import type { User } from "@/src/types/auth";

/**
 * Penanda sesi (bukan token) agar proxy bisa mengalihkan tamu dari halaman dashboard
 * sebelum render — seperti cookie sesi di MANGO. Autentikasi sebenarnya tetap via JWT.
 */
export const SESSION_COOKIE = "slpm_session";

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
  status?: number;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const { data } = await api.get<User>("/users/me");
    setUser(data);
    return data;
  }, []);

  // Pulihkan sesi dari refresh token (cookie HttpOnly) saat aplikasi dimuat.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAccessToken();
        const { data } = await api.get<User>("/users/me");
        if (!cancelled) setUser(data);
      } catch {
        tokenStore.set(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (user) Cookies.set(SESSION_COOKIE, "1", { path: "/", sameSite: "lax" });
    else Cookies.remove(SESSION_COOKIE, { path: "/" });
  }, [user, isLoading]);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const { data } = await api.post<{ access_token: string }>("/auth/login", { email, password });
        tokenStore.set(data.access_token);
        // set sebelum user ter-set (bukan menunggu effect) agar navigasi berikutnya lolos proxy
        Cookies.set(SESSION_COOKIE, "1", { path: "/", sameSite: "lax" });
        const me = await fetchMe();
        return { success: true, user: me };
      } catch (error) {
        Cookies.remove(SESSION_COOKIE, { path: "/" });
        const status = (error as { response?: { status?: number } })?.response?.status;
        return { success: false, status, error: getErrorMessage(error, "") };
      }
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // abaikan — sesi lokal tetap dibersihkan
    }
    tokenStore.set(null);
    Cookies.remove(SESSION_COOKIE, { path: "/" });
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      return await fetchMe();
    } catch {
      return null;
    }
  }, [fetchMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      login,
      logout,
      refreshUser,
      setUser,
    }),
    [user, isLoading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
