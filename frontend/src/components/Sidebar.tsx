"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LanguageSwitch from "./LanguageSwitch";
import { useT } from "@/lib/i18n/context";

const NAV = [
  { href: "/",           key: "nav.overview",   glyph: "●" },
  { href: "/simulation", key: "nav.simulation", glyph: "◆" },
  { href: "/analysis",   key: "nav.analysis",   glyph: "◇" },
  { href: "/backtest",   key: "nav.backtest",   glyph: "▲" },
  { href: "/vault",      key: "nav.vault",      glyph: "⬡" },
  { href: "/settings",   key: "nav.settings",   glyph: "⚙" },
];

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useT();

  // Auto-close the mobile drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <>
      {/* Mobile trigger — visible below the `lg` breakpoint */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-[34px] z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] text-muted backdrop-blur-sm hover:text-white lg:hidden"
        aria-label={t("nav.section")}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`fixed left-0 top-[26px] z-40 flex h-[calc(100vh-26px)] w-60 flex-col border-r border-[var(--border)] bg-[var(--bg-elev)]/90 backdrop-blur-sm transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-sm font-bold text-white shadow-glow">
              F
              <span className="absolute -inset-[3px] -z-10 rounded-[14px] bg-accent-gradient opacity-40 blur" />
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight">FintasTech</h1>
              <p className="text-[11px] text-dim">{t("nav.brandSubtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-dim hover:bg-[var(--bg-hover)] hover:text-white lg:hidden"
            aria-label="×"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-3">
          <LanguageSwitch />
        </div>

        <div className="px-5 pb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-dim">
          {t("nav.section")}
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? path === "/"
                : path === item.href || path.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  active
                    ? "bg-[var(--accent-glow)] text-white"
                    : "text-muted hover:bg-[var(--bg-hover)] hover:text-white"
                }`}
              >
                <span
                  className={`text-[10px] ${
                    active ? "text-accent" : "text-dim group-hover:text-accent"
                  }`}
                >
                  {item.glyph}
                </span>
                <span className="flex-1 font-medium">{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] px-5 py-4">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-warn">
            <span className="h-1.5 w-1.5 rounded-full bg-warn animate-pulse-soft" />
            {t("footer.paperOnly")}
          </p>
          <p className="whitespace-pre-line text-[10px] leading-relaxed text-dim">
            {t("footer.stack")}
          </p>
        </div>
      </aside>
    </>
  );
}
