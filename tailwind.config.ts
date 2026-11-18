import type { Config } from "tailwindcss";

// Palet diambil dari tempat sepatu dipakai: hijau lapangan, kuning garis
// marka, abu aspal, dan abu terang trotoar.
const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        court: { DEFAULT: "#0E6B5C", dark: "#0A5146", tint: "#E2F0ED" },
        marking: { DEFAULT: "#F2B233", dark: "#DFA021", tint: "#FDF3D7" },
        asphalt: { DEFAULT: "#1B2430", 700: "#2A3644", 500: "#5B6776", 300: "#A9B2BD" },
        pavement: { DEFAULT: "#F2F4F5", 200: "#E3E7EA", 300: "#CCD3D8" },
        danger: { DEFAULT: "#B83A3A", tint: "#FBECEC" },
        ink: { DEFAULT: "#111111", soft: "#333333", muted: "#707072" },
        studio: { DEFAULT: "#F5F5F5", card: "#E5E7EB", line: "#E5E5E5" },
        promo: { DEFAULT: "#9E3500", save: "#007D48" },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
