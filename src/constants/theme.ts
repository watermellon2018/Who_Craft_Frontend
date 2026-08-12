/**
 * Design tokens exported as plain JS strings, for cases where a CSS variable
 * cannot be used: SVG attributes (`stroke=`, `fill=`, `stopColor=`), AntD
 * component props (`<Tooltip color={...}>`), recharts series colors, etc.
 *
 * Tailwind classes (`bg-accent`, `text-accent`) and inline `style` props are
 * still preferred — they go through `var(--craft-accent)` and re-themeing
 * the palette stays a one-line change in src/index.css.
 *
 * Keep these in sync with the CSS variables defined in src/index.css.
 */
export const CRAFT_ACCENT = '#fab005';
export const CRAFT_ACCENT_HOVER = '#fcc419';
export const CRAFT_ACCENT_SECONDARY = '#d97706';
export const CRAFT_PLACEHOLDER = '#64778d';
