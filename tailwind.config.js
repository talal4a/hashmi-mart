/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#ffffff',
        accent: {
          DEFAULT: '#06b6d4',
          hover: '#0891b2',
          end: '#06b6d4',
          'end-hover': '#0891b2',
        },
      },
    },
  },
  plugins: [],
};
