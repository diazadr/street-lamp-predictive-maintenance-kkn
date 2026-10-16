import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const sameDeps = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Hook pemuatan data sederhana: menyimpan data, status loading & error,
 * serta fungsi reload. Perubahan `deps` memicu pemuatan ulang.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = [], initial?: T) {
  const [data, setData] = useState<T | undefined>(initial);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  // deps berubah → tandai loading saat render (pola "state dari render sebelumnya"),
  // sehingga effect di bawah hanya mengubah state setelah request selesai.
  const [prevDeps, setPrevDeps] = useState(deps);
  if (!sameDeps(prevDeps, deps)) {
    setPrevDeps(deps);
    setIsLoading(true);
    setError(null);
  }

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetcherRef.current().then(
      (result) => {
        if (!active) return;
        setData(result);
        setIsLoading(false);
      },
      (err) => {
        if (!active) return;
        setError(err);
        setIsLoading(false);
      }
    );
    // abaikan respons lama bila deps sudah berubah lagi (mis. ganti rentang cepat)
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, isLoading, error, reload };
}

/** Jalankan beberapa request paralel; yang gagal menghasilkan undefined (tidak menggagalkan semuanya). */
export async function settle<T extends readonly unknown[]>(
  promises: { [K in keyof T]: Promise<T[K]> }
): Promise<{ [K in keyof T]: T[K] | undefined }> {
  const results = await Promise.allSettled(promises as unknown as Promise<unknown>[]);
  return results.map((r) => (r.status === "fulfilled" ? r.value : undefined)) as { [K in keyof T]: T[K] | undefined };
}
