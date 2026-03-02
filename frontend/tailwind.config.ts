import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#fafafa',
        panel: '#ffffff',
        border: '#dbdbdb',
        text: '#262626',
        muted: '#737373',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;