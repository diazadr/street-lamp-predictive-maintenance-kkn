import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Access token disimpan di memori (bukan localStorage) untuk mitigasi XSS.
 * Refresh token berupa cookie HttpOnly yang dikirim otomatis oleh browser.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let queue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

const flushQueue = (error: unknown, token: string | null) => {
  queue.forEach(({ resolve, reject }) => (error || !token ? reject(error) : resolve(token)));
  queue = [];
};

export async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post<{ access_token: string }>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  tokenStore.set(data.access_token);
  return data.access_token;
}

const AUTH_ENDPOINTS = ["/auth/login", "/auth/refresh", "/auth/register"];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!original || AUTH_ENDPOINTS.some((p) => original.url?.includes(p))) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;
      try {
        const token = await refreshAccessToken();
        flushQueue(null, token);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        tokenStore.set(null);
        onUnauthorized?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/** Normalisasi respons list: backend kadang mengembalikan array, kadang {items,total}. */
export function toList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export function toTotal(data: unknown, fallback: number): number {
  if (data && typeof data === "object" && typeof (data as { total?: unknown }).total === "number") {
    return (data as { total: number }).total;
  }
  return fallback;
}

/** Ambil pesan error dari FastAPI ({detail}) secara aman. */
export function getErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as AxiosError<{ detail?: unknown }>)?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

/** Unduh blob dari endpoint API sebagai file. */
export async function downloadFile(url: string, filename: string, params?: Record<string, string>) {
  const response = await api.get(url, { params, responseType: "blob" });
  const href = URL.createObjectURL(response.data as Blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
