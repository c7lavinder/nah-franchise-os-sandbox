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
        // NAH Brand — Primary Blue
        nah: {
          blue: "#00a1e1",
          "blue-hover": "#0090ca",
          "blue-active": "#0080b5",
          "blue-light": "#e6f7fd",
          "blue-mid": "#b3e4f7",
        },
        // NAH Accent — Yellow/Orange
        accent: {
          yellow: "#f5a800",
          "yellow-hover": "#e09700",
          "yellow-light": "#fef3e2",
        },
        // Brand gray
        brand: {
          gray: "#898a8d",
        },
        // Scout AI — uses NAH blue for consistency
        scout: {
          purple: "#00a1e1",
          "purple-hover": "#0090ca",
          "purple-active": "#0080b5",
          "bubble-bg": "rgba(0, 161, 225, 0.08)",
          "bubble-border": "rgba(0, 161, 225, 0.20)",
          "action-bg": "rgba(0, 161, 225, 0.05)",
          thinking: "#00a1e1",
        },
        // Backgrounds
        bg: {
          primary: "#f4f7f8",
          secondary: "rgba(255, 255, 255, 0.75)",
          tertiary: "#f1f5f9",
          hover: "rgba(0, 161, 225, 0.05)",
          active: "rgba(0, 161, 225, 0.10)",
        },
        // Text
        text: {
          primary: "#1e293b",
          secondary: "#64748b",
          tertiary: "#94a3b8",
          inverse: "#ffffff",
        },
        // Semantic
        success: "#059669",
        warning: "#f5a800",
        danger: "#ef4444",
        info: "#00a1e1",
        // Borders
        border: {
          default: "rgba(0, 0, 0, 0.06)",
          hover: "rgba(0, 0, 0, 0.12)",
          focus: "#00a1e1",
          glass: "rgba(255, 255, 255, 0.6)",
        },
        // Surface
        surface: {
          glass: "rgba(255, 255, 255, 0.75)",
          solid: "#ffffff",
        },
        // Legacy aliases for backward compat — maps old dark tokens to new light ones
        "nah-orange": "#00a1e1",
      },
      fontFamily: {
        headline: ["Signika", "sans-serif"],
        sans: ["Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
      },
      fontSize: {
        hero: ["3.5rem", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-1px" }],
        "page-title": ["2rem", { lineHeight: "1.25", fontWeight: "600", letterSpacing: "-0.5px" }],
        "section-title": ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        "card-title": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        "label-caps": ["0.75rem", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "1.2px" }],
        metric: ["2rem", { lineHeight: "1.1", fontWeight: "700" }],
        "metric-sm": ["1.25rem", { lineHeight: "1.2", fontWeight: "600" }],
        nav: ["0.9375rem", { lineHeight: "1", fontWeight: "500" }],
        subtitle: ["1.25rem", { lineHeight: "1.5", fontWeight: "400" }],
        // Legacy aliases
        display: ["2rem", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["2rem", { lineHeight: "1.25", fontWeight: "600" }],
        h2: ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        body: ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["0.8125rem", { lineHeight: "1.4", fontWeight: "400" }],
        overline: ["0.75rem", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "1.2px" }],
        button: ["0.875rem", { lineHeight: "1", fontWeight: "500" }],
        badge: ["0.75rem", { lineHeight: "1", fontWeight: "600", letterSpacing: "0.3px" }],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        pill: "40px",
      },
      spacing: {
        sidebar: "80px",
        "sidebar-expanded": "280px",
        topbar: "0px",
      },
      maxWidth: {
        content: "1280px",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 80%, 100%": { opacity: "0" },
          "40%": { opacity: "1" },
        },
        drift: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -20px) scale(1.02)" },
          "66%": { transform: "translate(-15px, 25px) scale(0.98)" },
          "100%": { transform: "translate(20px, 10px) scale(1.03)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s infinite ease-in-out both",
        drift: "drift 30s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};

export default config;
