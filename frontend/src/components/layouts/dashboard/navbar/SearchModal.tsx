"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, Lamp, MapPin, Ticket, CornerDownLeft, Loader2, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, VisuallyHidden } from "@/src/components/ui/dialog";
import { StatusBadge } from "@/src/components/ui/dashboard/StatusBadge";
import { useRouter } from "@/src/i18n/navigation";
import { api } from "@/src/lib/http/axios";
import { cn } from "@/src/lib/utils";

interface SearchItem {
  id: string;
  lamp_code?: string;
  name?: string;
  title?: string;
  status?: string;
  priority?: string;
}

type Results = Record<string, SearchItem[]>;

const CATEGORY_ICONS: Record<string, LucideIcon> = { lamps: Lamp, places: MapPin, tickets: Ticket };
const CATEGORY_ROUTES: Record<string, (id: string) => string> = {
  lamps: (id) => `/workspace/lamps/${id}`,
  places: (id) => `/workspace/places/${id}`,
  tickets: (id) => `/workspace/tickets/${id}`,
};

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("SearchModal");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flat = useMemo(
    () =>
      Object.entries(results).flatMap(([category, items]) =>
        (items || []).map((item) => ({ ...item, _category: category }))
      ),
    [results]
  );

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({});
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<Results>("/search", { params: { q } });
      setResults(data || {});
      setSelected(0);
    } catch {
      setResults({});
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const go = useCallback(
    (item: SearchItem & { _category: string }) => {
      const route = CATEGORY_ROUTES[item._category];
      if (!route) return;
      router.push(route(item.id));
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((p) => Math.min(p + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter" && flat[selected]) {
        e.preventDefault();
        go(flat[selected]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flat, selected, go]);

  let index = -1;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setQuery("");
          setResults({});
        }
      }}
    >
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden top-[20%] translate-y-0">
        <VisuallyHidden>
          <DialogTitle>{t("title")}</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center gap-3 border-b border-border px-4 h-14">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t("placeholder")}
            className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <p>{t("hint")}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
                <span><kbd className="rounded border border-border px-1.5">Ctrl K</kbd> {t("kbd_open")}</span>
                <span><kbd className="rounded border border-border px-1.5">↑ ↓</kbd> {t("kbd_nav")}</span>
                <span><kbd className="rounded border border-border px-1.5">Enter</kbd> {t("kbd_select")}</span>
              </div>
            </div>
          ) : !loading && flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("no_result", { query })}</p>
          ) : (
            Object.entries(results).map(([category, items]) => {
              if (!items?.length) return null;
              const Icon = CATEGORY_ICONS[category] || Search;
              return (
                <div key={category} className="mb-2">
                  <p className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" /> {t.has(`categories.${category}`) ? t(`categories.${category}`) : category}
                  </p>
                  {items.map((item) => {
                    index++;
                    const i = index;
                    return (
                      <button
                        key={`${category}-${item.id}`}
                        onClick={() => go({ ...item, _category: category })}
                        onMouseEnter={() => setSelected(i)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                          i === selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                        )}
                      >
                        <span className="flex-1 truncate font-medium">{item.lamp_code || item.name || item.title || item.id}</span>
                        {item.status && <StatusBadge value={item.status} />}
                        {item.priority && <StatusBadge value={item.priority} />}
                        {i === selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
