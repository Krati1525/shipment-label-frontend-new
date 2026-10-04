/**
 * Theme Color Calculation & CSS Variable Utilities
 */

export interface PresetColor {
  name: string;
  hex: string;
}

export const DEFAULT_PRIMARY_COLOR = '#2563eb';

export const PRESET_THEME_COLORS: PresetColor[] = [
  { name: 'Royal Blue (Default)', hex: '#2563eb' },
  { name: 'Indigo Aura', hex: '#6366f1' },
  { name: 'Electric Violet', hex: '#8b5cf6' },
  { name: 'Neon Purple', hex: '#a855f7' },
  { name: 'Crimson Rose', hex: '#f43f5e' },
  { name: 'Sunset Orange', hex: '#f97316' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Emerald Mint', hex: '#10b981' },
  { name: 'Ocean Cyan', hex: '#06b6d4' },
  { name: 'Midnight Slate', hex: '#475569' },
];

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim().replace(/^#/, '');

  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (clean.length !== 6) return null;

  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function getContrastTextColor(r: number, g: number, b: number): string {
  // Relative luminance: https://www.w3.org/WAI/GL/wiki/Relative_luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#0f172a' : '#ffffff';
}

function adjustBrightness(r: number, g: number, b: number, factor: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const nr = clamp(r * factor);
  const ng = clamp(g * factor);
  const nb = clamp(b * factor);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

export function generatePrimaryTokens(hex: string, isDark: boolean): Record<string, string> | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const { r, g, b } = rgb;
  const contrast = getContrastTextColor(r, g, b);

  // In light mode, hover is slightly darker; in dark mode, hover is slightly brighter/more saturated
  const hoverHex = isDark
    ? adjustBrightness(r, g, b, 1.15)
    : adjustBrightness(r, g, b, 0.85);

  const lightOpacity = isDark ? 0.20 : 0.12;
  const borderOpacity = isDark ? 0.38 : 0.28;
  const ringOpacity = isDark ? 0.25 : 0.16;

  return {
    '--primary': hex,
    '--primary-hover': hoverHex,
    '--primary-light': `rgba(${r}, ${g}, ${b}, ${lightOpacity})`,
    '--primary-border': `rgba(${r}, ${g}, ${b}, ${borderOpacity})`,
    '--primary-contrast': contrast,
    '--border-focus': hex,
    '--primary-focus-ring': `rgba(${r}, ${g}, ${b}, ${ringOpacity})`,
  };
}

export function applyPrimaryColorToDOM(hex: string, isDark: boolean): void {
  if (typeof document === 'undefined') return;
  const tokens = generatePrimaryTokens(hex, isDark);
  if (!tokens) return;

  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

export function removePrimaryColorFromDOM(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const keys = [
    '--primary',
    '--primary-hover',
    '--primary-light',
    '--primary-border',
    '--primary-contrast',
    '--border-focus',
    '--primary-focus-ring',
  ];
  for (const key of keys) {
    root.style.removeProperty(key);
  }
}
