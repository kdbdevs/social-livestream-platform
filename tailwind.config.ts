import type { Config } from "tailwindcss";

export default {
  content: [
    "./apps/**/*.{html,ts,tsx}",
    "./packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        "text-primary": "rgb(var(--color-text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--color-text-secondary) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Aptos", "\"Segoe UI Variable Text\"", "\"Trebuchet MS\"", "sans-serif"],
        display: ["\"Bahnschrift\"", "\"Aptos Display\"", "\"Segoe UI Variable Text\"", "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 80px rgba(8, 14, 31, 0.26)",
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(7, 27, 55, 0.35)",
      },
      keyframes: {
        floatUp: {
          "0%": { opacity: "0", transform: "translate3d(0, 20px, 0) scale(0.8)" },
          "15%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
          "100%": { opacity: "0", transform: "translate3d(0, -90px, 0) scale(1.08)" },
        },
        bannerPop: {
          "0%": { opacity: "0", transform: "translate3d(0, 24px, 0) scale(0.92)" },
          "20%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
          "80%": { opacity: "1", transform: "translate3d(0, 0, 0) scale(1)" },
          "100%": { opacity: "0", transform: "translate3d(0, -12px, 0) scale(1.03)" },
        },
        pulseRing: {
          "0%": { opacity: "0.5", transform: "scale(0.9)" },
          "100%": { opacity: "0", transform: "scale(1.45)" },
        },
      },
      animation: {
        "gift-float": "floatUp 1.7s ease-out forwards",
        "gift-banner": "bannerPop 3.2s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "pulse-ring": "pulseRing 0.7s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
