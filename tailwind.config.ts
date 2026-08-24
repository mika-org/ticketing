import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151426",
        paper: "#f6f5fb",
        moss: {
          50: "#f3f0ff",
          100: "#e8e1ff",
          500: "#7c5cff",
          600: "#6846f4",
          700: "#5330d6",
        },
        amber: { 400: "#c9ff63", 500: "#aee83d" },
      },
      boxShadow: {
        soft: "0 20px 60px rgba(41, 31, 86, 0.10)",
        glow: "0 18px 48px rgba(104, 70, 244, 0.25)",
      },
    },
  },
  plugins: [forms],
};

export default config;
