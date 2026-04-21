"use client";

// Minimal i18n context — intentionally zero-dependency so it works in any
// Next.js/React stack without pulling `next-intl` / `react-i18next`.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  t as translate,
} from "./messages";

const STORAGE_KEY = "fintastech.locale.v1";

function detectInitial(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LOCALES as string[]).includes(saved)) return saved as Locale;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  return nav.toLowerCase().startsWith("zh") ? "zh" : "en";
}

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage / navigator.language after mount.
  useEffect(() => {
    setLocaleState(detectInitial());
  }, []);

  // Keep <html lang="…"> in sync for accessibility + search engines.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

/**
 * `const { t, locale, setLocale } = useT();`
 * Fallback-safe: if the provider wasn't mounted (e.g. misused in a
 * standalone test), returns identity-ish translations instead of crashing.
 */
export function useT() {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key: string, vars?: Record<string, string | number>) =>
      translate(DEFAULT_LOCALE, key, vars),
  } satisfies Ctx;
}
