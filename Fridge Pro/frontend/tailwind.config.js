/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FCFAF7",
          100: "#F8F6F2",
          200: "#F2EFE9",
          300: "#E8E4DC",
        },
        primary: {
          50: "#F4F7F5",
          100: "#E5EDE8",
          200: "#C9DCD1",
          300: "#A4C3B2",
          400: "#6B9C83",
          500: "#3B6B55", // Nordic Sage
          600: "#2D5A46", // Scandinavian Forest
          700: "#214334", // Deep Pine
          800: "#183328", // Nordic Spruce
          900: "#0F221A",
        },
        coral: {
          50: "#FAF4F2",
          100: "#F5E8E4",
          200: "#EBD1C8",
          300: "#E0B3A5",
          400: "#D48B77",
          500: "#C86242", // Nordic Terracotta
          600: "#B35133",
          700: "#923F27",
        },
        frost: {
          50: "#F4F7F8",
          100: "#E6EFF2",
          200: "#CCE0E7",
          400: "#8CB9CA",
          500: "#5C8E9E",
          600: "#447080",
          700: "#325460",
        },
        stone: {
          charcoal: "#1A1C19",
          muted: "#6F726D",
          border: "#E8E5DF",
          divider: "#F0EDE8",
        },
        emerald: {
          50: "#F4F7F5",
          100: "#E5EDE8",
          200: "#C9DCD1",
          300: "#A4C3B2",
          400: "#6B9C83",
          500: "#3B6B55", // Nordic Sage
          600: "#2D5A46", // Scandinavian Forest
          700: "#214334", // Deep Pine
          800: "#183328", // Nordic Spruce
          900: "#0F221A",
          950: "#08130E",
        },
        rose: {
          50: "#FAF4F2",
          100: "#F5E8E4",
          200: "#EBD1C8",
          300: "#E0B3A5",
          400: "#D48B77",
          500: "#C86242", // Nordic Terracotta
          600: "#B35133",
          700: "#923F27",
          800: "#752F1B",
          900: "#5A2314",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          subtle: "#FAF9F6",
          muted: "#F3F1EC",
        },
      },
      fontFamily: {
        sans: ['"Geist"', '"Plus Jakarta Sans"', "Inter", "sans-serif"],
        display: ['"Geist"', '"Plus Jakarta Sans"', "sans-serif"],
      },
      borderRadius: {
        "xl": "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2.25rem",
      },
      boxShadow: {
        "soft-xs": "0 1px 3px rgba(24, 51, 40, 0.02)",
        "soft": "0 2px 8px rgba(24, 51, 40, 0.03)",
        "card": "0 1px 4px rgba(24, 51, 40, 0.03), 0 4px 16px rgba(24, 51, 40, 0.02)",
        "card-hover": "0 6px 24px rgba(24, 51, 40, 0.06), 0 1px 4px rgba(24, 51, 40, 0.02)",
        "float": "0 16px 40px -8px rgba(24, 51, 40, 0.08)",
        "glow-emerald": "0 0 24px -4px rgba(45, 90, 70, 0.2)",
      },
    },
  },
  plugins: [],
};
