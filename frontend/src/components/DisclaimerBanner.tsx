"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

const STORAGE_KEY = "fintastech.disclaimer.ackv1";

export default function DisclaimerBanner() {
  const [ack, setAck] = useState(true); // default true to avoid SSR flash
  const { t } = useT();

  useEffect(() => {
    try {
      setAck(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setAck(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setAck(true);
  };

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 h-[26px] border-b border-[rgba(251,191,36,0.25)] bg-[rgba(12,10,2,0.9)] backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-center gap-2 px-4 text-[11px] font-medium text-warn">
          <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.1)] px-1.5 py-[1px] text-[9px] uppercase tracking-[0.16em]">
            {t("ribbon.tag")}
          </span>
          <span className="opacity-90">{t("ribbon.text")}</span>
        </div>
      </div>

      {!ack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-card">
            <div className="border-b border-[var(--border)] bg-gradient-to-r from-[rgba(251,191,36,0.12)] to-transparent p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-warn">
                <span className="h-1.5 w-1.5 rounded-full bg-warn animate-pulse-soft" />
                {t("disclaimer.title")}
              </h2>
            </div>
            <div className="p-6">
              <p className="mb-4 text-sm leading-relaxed text-muted">
                {t("disclaimer.intro")}
              </p>
              <ul className="mb-5 space-y-2 text-[13px] text-muted">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">·</span>
                    {t(`disclaimer.bullet${i}`)}
                  </li>
                ))}
              </ul>
              <button onClick={dismiss} className="btn-primary w-full">
                {t("disclaimer.accept")}
              </button>
              <p className="mt-3 text-center text-[10px] text-dim">
                {t("disclaimer.full")}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
