import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "texo-amarillo": "#E8B84B",
        "texo-verde": "#3A9688",
        "texo-rojo": "#C0544A",
        "texo-azul": "#31484E",
        "texo-dark": "#1a2a2e",
      },
    },
  },
  plugins: [],
};

export default config;
