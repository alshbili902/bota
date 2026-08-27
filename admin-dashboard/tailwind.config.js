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
        admin: {
          dark: '#0B0F17',
          card: '#111827',
          cardLight: '#FFFFFF',
          border: '#1F2937',
          borderLight: '#E5E7EB',
          accent: '#3B82F6',
          gold: '#F59E0B',
          emerald: '#10B981',
          rose: '#EF4444',
          indigo: '#6366F1',
        }
      },
      fontFamily: {
        tajawal: ['Tajawal', 'Cairo', 'sans-serif'],
        cairo: ['Cairo', 'Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
