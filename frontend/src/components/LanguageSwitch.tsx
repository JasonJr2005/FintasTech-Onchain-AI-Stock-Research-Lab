"use client";

import { useT } from "@/lib/i18n/context";
import { LOCALE_LABEL, LOCALES, type Locale } from "@/lib/i18n/messages";

/**
 * Two-option pill toggle (中文 / EN). Persists via LanguageProvider,
 * which writes `fintastech.locale.v1` to localStorage. The `compact`
 * variant drops the surrounding label — use it in tight side-bar
 * footers; the default variant is suitable for the top bar.
 */
export default function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useT();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-0.5 ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
      role="group"
      aria-label={t("common.switchLang")}
    >
      {LOCALES.map((l: Locale) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={`rounded px-2 py-0.5 font-medium tracking-wide transition-colors ${
              active
                ? "bg-accent-gradient text-white shadow-glow"
                : "text-muted hover:text-white"
            }`}
          >
            {LOCALE_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
