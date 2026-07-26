/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Semantic color tokens backed by CSS variables defined in src/index.css.
      // Prefer these over arbitrary values like `text-[#fab005]` so the palette
      // can be re-themed in one place. Use with /<opacity> modifier:
      // `bg-accent/10`, `border-accent/40`, etc.
      colors: {
        accent: {
          DEFAULT: 'var(--craft-accent)',
          hover: 'var(--craft-accent-hover)',
          soft: 'var(--craft-accent-soft)',
          border: 'var(--craft-accent-border)',
        },
      },
    },
  },
  plugins: [],
}
