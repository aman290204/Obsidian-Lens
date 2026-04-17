const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Material Design 3 color tokens (backed by CSS variables)
        background:               'var(--color-background)',
        'on-background':          'var(--color-on-background)',
        surface:                  'var(--color-surface)',
        'on-surface':             'var(--color-on-surface)',
        'surface-variant':        'var(--color-surface-variant)',
        'on-surface-variant':     'var(--color-on-surface-variant)',
        'surface-container':      'var(--color-surface-container)',
        'surface-container-low':  'var(--color-surface-container-low)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'surface-container-highest':'var(--color-surface-container-highest)',
        'surface-bright':         'var(--color-surface-bright)',
        primary:                  'var(--color-primary)',
        'on-primary':             'var(--color-on-primary)',
        'primary-dim':            'var(--color-primary-dim)',
        'primary-fixed':          'var(--color-primary-fixed)',
        'on-primary-fixed':       'var(--color-on-primary-fixed)',
        'primary-container':      'var(--color-primary-container)',
        secondary:                'var(--color-secondary)',
        'on-secondary':           'var(--color-on-secondary)',
        'secondary-container':    'var(--color-secondary-container)',
        'secondary-fixed':        'var(--color-secondary-fixed)',
        'on-secondary-fixed':     'var(--color-on-secondary-fixed)',
        'secondary-dim':          'var(--color-secondary-dim)',
        tertiary:                 'var(--color-tertiary)',
        'on-tertiary':            'var(--color-on-tertiary)',
        'tertiary-container':     'var(--color-tertiary-container)',
        error:                    'var(--color-error)',
        'on-error':               'var(--color-on-error)',
        outline:                  'var(--color-outline)',
        'outline-variant':        'var(--color-outline-variant)',
        glass: {
          bg: 'rgba(24, 24, 36, 0.7)',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      },
      backdropBlur: {
        'glass': '12px',
      },
      fontFamily: {
        sans:     ['Inter', ...defaultTheme.fontFamily.sans],
        headline: ['Space Grotesk', ...defaultTheme.fontFamily.sans],
        body:     ['Inter', ...defaultTheme.fontFamily.sans],
        inter:    ['Inter', ...defaultTheme.fontFamily.sans],
      },
      animation: {
        float:  'float 6s ease-in-out infinite',
        shimmer:'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};