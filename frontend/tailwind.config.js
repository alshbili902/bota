/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FDF8F7',
          100: '#FBF0EE',
          200: '#F5DDD9',
          300: '#EBC4BD',
          400: '#DEA398',
          500: '#D18173', // Warm rose gold
          600: '#B86153',
          700: '#96483C',
          800: '#7B3B32',
          900: '#67342C',
        },
        champagne: {
          50: '#FAF8F5',
          100: '#F5F1E8',
          200: '#EBE2D1',
          300: '#DFCDB5',
          400: '#D0B493',
        },
        slateDark: {
          800: '#1E1B24',
          850: '#19161F',
          900: '#14121A',
          950: '#0E0D12',
        }
      },
      fontFamily: {
        arabic: ['Tajawal', 'Cairo', 'sans-serif'],
        display: ['Tajawal', 'Outfit', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(209, 129, 115, 0.12)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        'soft': '0 10px 25px -5px rgba(209, 129, 115, 0.1), 0 8px 10px -6px rgba(209, 129, 115, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'pulse-subtle': 'pulseSubtle 3s infinite ease-in-out',
        'shimmer': 'shimmer 2.5s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}
