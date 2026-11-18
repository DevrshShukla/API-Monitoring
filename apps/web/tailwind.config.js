/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA', // Design token Primary
          800: '#3730A3', // Design token Primary hover
          900: '#312E81',
        },
        canvas: '#F8FAFC', // App background
        surface: '#FFFFFF', // Card/Surface
        boundary: '#E2E8F0', // Border
        ink: {
          primary: '#0F172A',
          secondary: '#64748B',
          muted: '#94A3B8',
        },
        state: {
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          info: '#0284C7',
        },
      },
    },
  },
  plugins: [],
};
