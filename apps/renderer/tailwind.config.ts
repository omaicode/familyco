import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            color: 'var(--fc-text-main)',
            maxWidth: 'none',
            a: {
              color: 'var(--fc-primary)',
              textDecoration: 'underline'
            },
            strong: {
              color: 'var(--fc-text-main)'
            },
            code: {
              color: 'var(--fc-text-main)'
            },
            blockquote: {
              color: 'var(--fc-text-muted)',
              borderLeftColor: 'var(--fc-primary)'
            },
            hr: {
              borderColor: 'var(--fc-border-subtle)'
            },
            thead: {
              color: 'var(--fc-text-main)'
            }
          }
        }
      }
    }
  },
  plugins: [typography]
};

export default config;
