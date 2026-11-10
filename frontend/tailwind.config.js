/** @type {import('tailwindcss').Config} */

// MarineSure palette. Existing pages use `slate`, `marine`, `cyan` and `purple`
// utility names; they are re-mapped here onto the maritime system so every
// screen shares one identity.
const navy = {
  50: '#F7FAFC', // Pearl White
  100: '#E8EFF4',
  200: '#CBD8E2',
  300: '#A7BACA',
  400: '#8CA2B6', // secondary text on navy (≥4.5:1 on 900)
  500: '#64748B', // Slate
  600: '#425A70',
  700: '#26405A',
  800: '#163650', // borders / raised surfaces
  900: '#0B2438', // cards
  950: '#061827', // Midnight Navy
}

const teal = {
  50: '#E8F6F5', // Sea Mist
  100: '#CDEFEC',
  200: '#9FE3DE',
  300: '#7BE3DC',
  400: '#54D8D0', // Aqua
  500: '#10B9AE', // Ocean Teal
  600: '#0E9A91',
  700: '#0C7B75',
  800: '#0D4664', // Marine Blue
  900: '#082B40', // Deep Ocean
  950: '#061827',
}

const gold = {
  50: '#FBF7EF',
  100: '#F5ECD9',
  200: '#EBD8B1',
  300: '#E0C593',
  400: '#D5B477', // Champagne Gold
  500: '#C49A55',
  600: '#A57E40',
  700: '#836334',
  800: '#5E4726',
  900: '#3D2E19',
  950: '#251B0E',
}

export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'] },
  theme: {
    extend: {
      colors: {
        slate: navy,
        navy,
        marine: teal,
        cyan: teal,
        teal,
        ocean: { DEFAULT: '#082B40', deep: '#061827', blue: '#0D4664' },
        gold,
        purple: gold,
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(2, 10, 18, 0.35), 0 8px 24px -12px rgba(2, 10, 18, 0.55)',
        lift: '0 2px 4px rgba(2, 10, 18, 0.35), 0 18px 40px -16px rgba(2, 10, 18, 0.7)',
        glow: '0 8px 30px -10px rgba(16, 185, 174, 0.45)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        'swell': { '0%,100%': { transform: 'translateX(0)' }, '50%': { transform: 'translateX(-25%)' } },
        'shimmer': { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
        'toast-in': { from: { opacity: 0, transform: 'translateY(12px) scale(0.98)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'swell': 'swell 28s ease-in-out infinite',
        'shimmer': 'shimmer 1.4s linear infinite',
        'toast-in': 'toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
