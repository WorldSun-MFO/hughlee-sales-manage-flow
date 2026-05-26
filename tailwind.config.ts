import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang TC"', '"Microsoft JhengHei"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        // v4 專屬字體(用法:font-v4-sans / font-v4-serif / font-v4-mono)
        'v4-sans': ['"IBM Plex Sans"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        'v4-serif': ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
        'v4-mono': ['"JetBrains Mono"', '"IBM Plex Mono"', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        // v4 色票(只在 /v4/* 路由用,不影響現有 Dashboard 的 slate/blue 系)
        ink: '#0e0d0c',
        graphite: '#1f1d1b',
        ash: '#3a3733',
        paper: '#f5f1e8',
        parchment: '#ebe4d4',
        cream: '#faf6ec',
        forest: '#1d4d3a',
        brass: '#8b6f2a',
        claret: '#7a2222',
        cobalt: '#1e3a8a',
      },
      letterSpacing: {
        label: '0.18em',
      },
      boxShadow: {
        panel: '0 1px 0 rgba(14,13,12,0.04), 0 24px 60px -28px rgba(14,13,12,0.22)',
        chip: '0 1px 0 rgba(14,13,12,0.05)',
        edge: 'inset 0 -1px 0 rgba(14,13,12,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
