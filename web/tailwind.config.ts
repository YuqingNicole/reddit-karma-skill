import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ff4500", // Reddit orange
          fg: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
