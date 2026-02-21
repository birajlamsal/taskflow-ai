import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          900: "var(--ink-900)",
          800: "var(--ink-800)",
          700: "var(--ink-700)",
          600: "var(--ink-600)",
          500: "var(--ink-500)",
          400: "var(--ink-400)"
        },
        pearl: {
          50: "var(--pearl-50)",
          100: "var(--pearl-100)",
          200: "var(--pearl-200)",
          300: "var(--pearl-300)"
        },
        accent: {
          500: "var(--accent-500)",
          600: "var(--accent-600)",
          700: "var(--accent-700)"
        },
        sunset: {
          500: "var(--sunset-500)",
          600: "var(--sunset-600)"
        }
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 20px 40px rgba(76, 224, 210, 0.2)",
        lift: "0 12px 24px rgba(9, 12, 20, 0.18)",
        card: "0 10px 30px rgba(20, 25, 38, 0.12)"
      },
      backgroundImage: {
        "soft-radial":
          "radial-gradient(circle at top, rgba(76, 224, 210, 0.2), transparent 55%)",
        sunset:
          "radial-gradient(circle at 20% 20%, rgba(255, 159, 110, 0.3), transparent 45%)"
      }
    }
  },
  plugins: []
};

export default config;
