/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        night: {
          950: "#05070f",
          900: "#0a0f1e",
          800: "#111731",
        },
        neon: {
          cyan: "#22d3ee",
          purple: "#a78bfa",
          pink: "#f472b6",
        },
      },
    },
  },
  plugins: [],
};
