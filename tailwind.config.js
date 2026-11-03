/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"SDK SC Web"', '"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        sdk: ['"SDK SC Web"', '"SDK SC"', 'sans-serif'],
      },
      colors: {
        vietvoice: {
          primary: '#6255CF',
          primaryHover: '#5144BD',
          bg: '#F7F8FC',
          surface: '#FFFFFF',
          text: '#20213A',
          subtext: '#85879A',
          border: '#E8E8F0',
          male: '#5578D8',
          female: '#B16BC1',
        },
        amtu: {
          primary: '#6255CF',
          primaryHover: '#5144BD',
          bg: '#F7F8FC',
          surface: '#FFFFFF',
          text: '#20213A',
          subtext: '#85879A',
          border: '#E8E8F0',
          male: '#5578D8',
          female: '#B16BC1',
        },
        brand: {
          cyan: '#06b6d4',
          magenta: '#ec4899',
          indigo: '#6255CF',
          violet: '#8b5cf6',
        }
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave-dance': 'waveDance 1.2s ease-in-out infinite alternate',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '0.4' },
        },
        waveDance: {
          '0%': { transform: 'scaleY(0.3)' },
          '100%': { transform: 'scaleY(1)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
