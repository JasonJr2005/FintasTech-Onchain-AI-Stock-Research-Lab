import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'Geist'",
          "'Inter'",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Noto Sans SC'",
          "sans-serif",
        ],
        mono: [
          "'Geist Mono'",
          "'JetBrains Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        bg: {
          DEFAULT: "#07070c",
          elevated: "#0c0c14",
          card: "#111118",
          hover: "#16161f",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.10)",
        },
        accent: {
          DEFAULT: "#a78bfa",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          glow: "rgba(139,92,246,0.35)",
        },
        gain: "#34d399",
        loss: "#f87171",
        warn: "#fbbf24",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px -12px rgba(0,0,0,0.65)",
        glow: "0 0 0 1px rgba(139,92,246,0.35), 0 20px 60px -20px rgba(139,92,246,0.35)",
      },
      backgroundImage: {
        "grid-subtle":
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        "accent-gradient":
          "linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #4f46e5 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
