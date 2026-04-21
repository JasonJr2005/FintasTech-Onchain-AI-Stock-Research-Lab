"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

const RISK_KEY = "fintastech.risk.v1";
const HORIZON_KEY = "fintastech.backtest.horizon.v1";

const PROFILE_IDS = ["conservative", "moderate", "aggressive"] as const;
const PROFILE_CAPS: Record<(typeof PROFILE_IDS)[number], string> = {
  conservative: "≤ 10%",
  moderate: "≤ 20%",
  aggressive: "≤ 35%",
};

export default function SettingsPage() {
  const { t } = useT();
  const [tolerance, setTolerance] = useState<string>("moderate");
  const [horizon, setHorizon] = useState("12");
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage so the page reflects what the rest of the app is using.
  useEffect(() => {
    try {
      const r = localStorage.getItem(RISK_KEY);
      if (r) setTolerance(r);
      const h = localStorage.getItem(HORIZON_KEY);
      if (h) setHorizon(h);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function save() {
    try {
      localStorage.setItem(RISK_KEY, tolerance);
      localStorage.setItem(HORIZON_KEY, horizon);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-8 py-10">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {t("settings.tag")}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("settings.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      <h3 className="mb-3 text-sm font-medium text-muted">{t("settings.risk.title")}</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {PROFILE_IDS.map((id) => {
          const active = tolerance === id;
          return (
            <button
              key={id}
              onClick={() => {
                setTolerance(id);
                setSaved(false);
              }}
              className={`surface surface-hover p-5 text-left ${
                active ? "!border-accent !shadow-glow" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">
                  {t(`settings.profile.${id}.label`)}
                </span>
                <span className="chip font-mono">{PROFILE_CAPS[id]}</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {t(`settings.profile.${id}.desc`)}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-10 max-w-md">
        <label className="mb-2 block text-[11px] uppercase tracking-wider text-dim">
          {t("settings.horizon.label")}
        </label>
        <input
          type="range"
          min={1}
          max={60}
          value={horizon}
          onChange={(e) => {
            setHorizon(e.target.value);
            setSaved(false);
          }}
          className="w-full accent-[var(--accent)]"
        />
        <div className="mt-2 flex justify-between text-[11px] text-dim">
          <span>1</span>
          <span className="font-mono text-white">
            {horizon} {t("settings.horizon.suffix")}
          </span>
          <span>60</span>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <button
          onClick={save}
          disabled={!hydrated}
          className="btn-primary disabled:opacity-50"
        >
          {t("settings.save")}
        </button>
        {saved && <span className="text-sm text-gain">{t("settings.saved")}</span>}
      </div>
    </div>
  );
}
