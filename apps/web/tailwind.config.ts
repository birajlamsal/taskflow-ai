import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0b0f1a",
          800: "#111726",
          700: "#1a2134",
          600: "#28324a",
          500: "#3b4a6a"
        },
        pearl: {
          50: "#f7f7fb",
          100: "#eceff6",
          200: "#d6dceb",
          300: "#b7c0da"
        },
        accent: {
          500: "#4ce0d2",
          600: "#2bb9ad",
          700: "#1a8a84"
        },
        sunset: {
          500: "#ff9f6e",
          600: "#f68145"
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
