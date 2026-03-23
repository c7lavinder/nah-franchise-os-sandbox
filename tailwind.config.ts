import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // NAH Brand
        nah: {
          orange: "#E8431A",
          "orange-hover": "#D13A15",
          "orange-active": "#BA3312",
        },
        // Scout AI accent
        scout: {
          purple: "#7C3AED",
          "purple-hover": "#6D28D9",
          "purple-active": "#5B21B6",
          "bubble-bg": "rgba(124, 58, 237, 0.10)",
          "bubble-border": "rgba(124, 58, 237, 0.20)",
          "action-bg": "rgba(124, 58, 237, 0.05)",
          thinking: "#7C3AED",
        },
        // Backgrounds
        bg: {
          primary: "#0F0F0F",
          secondary: "#1A1A1A",
          tertiary: "#262626",
          hover: "#333333",
          active: "#404040",
        },
        // Text
        text: {
          primary: "#F5F5F5",
          secondary: "#A3A3A3",
          tertiary: "#737373",
          inverse: "#0F0F0F",
        },
        // Semantic
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        // Borders
        border: {
          default: "#2A2A2A",
          hover: "#404040",
          focus: "#E8431A",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Courier New",
          "monospace",
        ],
      },
      fontSize: {
        display: ["2rem", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["1.5rem", { lineHeight: "1.3", fontWeight: "700" }],
        h2: ["1.25rem", { lineHeight: "1.35", fontWeight: "600" }],
        h3: ["1rem", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        body: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["0.75rem", { lineHeight: "1.4", fontWeight: "400" }],
        overline: ["0.6875rem", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "0.05em" }],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      spacing: {
        "sidebar": "240px",
        "sidebar-collapsed": "64px",
        "topbar": "56px",
      },
      maxWidth: {
        content: "1280px",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 80%, 100%": { opacity: "0" },
          "40%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s infinite ease-in-out both",
      },
    },
  },
  plugins: [],
};

export default config;
