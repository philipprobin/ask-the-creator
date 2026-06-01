import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f0f0f",
        panel: "#181818",
        border: "#2a2a2a",
        accent: "#ff0033",
      },
    },
  },
  plugins: [],
} satisfies Config;
