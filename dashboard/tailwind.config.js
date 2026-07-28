/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dash: {
          bg:       '#060918',
          sidebar:  '#060a18',
          card:     '#0c1428',
          card2:    '#0f1930',
          border:   'rgba(59,130,246,0.15)',
          border2:  'rgba(255,255,255,0.06)',
        },
        safe:     '#22c55e',
        warn:     '#f59e0b',
        crit:     '#ef4444',
        mis:      '#8b5cf6',
        brand:    '#3b82f6',
        hr:       '#f43f5e',
        spo2:     '#06b6d4',
        rri:      '#a78bfa',
        temp:     '#fb923c',
        co:       '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter','system-ui','sans-serif'],
        mono: ['JetBrains Mono','Consolas','monospace'],
      },
      boxShadow: {
        card:      '0 2px 16px rgba(0,0,0,0.5)',
        glow:      '0 0 20px rgba(59,130,246,0.15)',
        'glow-g':  '0 0 20px rgba(34,197,94,0.15)',
        'glow-r':  '0 0 20px rgba(239,68,68,0.15)',
        'glow-a':  '0 0 20px rgba(245,158,11,0.15)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        blink:      'blink 1.4s ease infinite',
      },
      keyframes: {
        fadeIn:  { from:{ opacity:0 }, to:{ opacity:1 } },
        slideUp: { from:{ opacity:0, transform:'translateY(8px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        blink:   { '0%,100%':{ opacity:1 }, '50%':{ opacity:0.3 } },
      },
    },
  },
  plugins: [],
}
