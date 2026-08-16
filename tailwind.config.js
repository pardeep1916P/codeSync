/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/popup/index.html",
    "./src/options/index.html",
    "./src/popup/**/*.{js,ts,jsx,tsx}",
    "./src/options/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
