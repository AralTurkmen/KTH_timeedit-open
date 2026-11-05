import { createContext, useContext } from 'react';

export interface Palette {
  bg: string;
  card: string;
  text: string;
  sub: string;
  border: string;
  accent: string;
  onAccent: string;
  warnBg: string;
  warnText: string;
  danger: string;
  dark: boolean;
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#ffffff', card: '#f3f4f6', text: '#111827', sub: '#6b7280', border: '#d1d5db',
    accent: '#2563eb', onAccent: '#ffffff', warnBg: '#fde8c8', warnText: '#3b2a05',
    danger: '#dc2626', dark: false,
  },
  dark: {
    bg: '#0f1115', card: '#1a1d24', text: '#f3f4f6', sub: '#9ca3af', border: '#2f3541',
    accent: '#60a5fa', onAccent: '#0b1220', warnBg: '#4a3510', warnText: '#fde8c8',
    danger: '#f87171', dark: true,
  },
};

export const ThemeContext = createContext<Palette>(palettes.light);
export const useColors = () => useContext(ThemeContext);
