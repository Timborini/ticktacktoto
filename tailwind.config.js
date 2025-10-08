/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <-- This is the line you need to add
  content: [
    "./src/App.jsx",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}