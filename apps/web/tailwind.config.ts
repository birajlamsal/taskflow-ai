import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: "rgba(255,255,255,0.08)",
        night: "#0b0f1a",
        glow: "#6ee7ff"
      }
    }
  },
  plugins: []
};

export default config;
