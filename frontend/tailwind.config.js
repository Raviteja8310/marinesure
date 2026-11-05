/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        marine: {
          50: '#f0f7fc',
          100: '#e0eff9',
          200: '#b9e0f3',
          300: '#7dc8eb',
          400: '#3aaee0',
          500: '#1193cd',
          600: '#0776ad',
          700: '#085e8d',
          800: '#0b5074',
          900: '#0e4361',
          950: '#092b41',
        },
      },
    },
  },
  plugins: [],
}
