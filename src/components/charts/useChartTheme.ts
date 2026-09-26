'use client';

import { useSyncExternalStore } from 'react';
import type { ChartTheme } from '@/lib/charts/echartsOption';

let cached: ChartTheme | null = null;
let cachedKey = '';

function read(): ChartTheme {
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark' || (root.dataset.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const key = `${root.dataset.theme}|${root.dataset.contrast}|${dark}|${root.style.cssText}`;
  if (cached && key === cachedKey) return cached;
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(name).trim();
  cached = {
    palette: [1, 2, 3, 4, 5, 6, 7].map((i) => v(`--chart-${i}`)),
    other: v('--chart-8'),
    text: v('--fg'),
    text2: v('--fg-2'),
    line: v('--line-strong'),
    surface: v('--surface'),
    accent: v('--accent'),
    sequential: dark ? ['#243a5c', '#8fb3e8'] : ['#dce6f3', '#2c62a8'],
    fontFamily: `${v('--font-manrope') || 'Manrope'}, system-ui, sans-serif`,
  };
  cachedKey = key;
  return cached;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-contrast', 'style'] });
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    mql.removeEventListener('change', onChange);
  };
}

const fallback: ChartTheme = {
  palette: ['#2c62a8', '#e85d56', '#1b998b', '#8e5ba8', '#d69a1d', '#5aa9de', '#c4507f'],
  other: '#7d8aa6',
  text: '#0f2747',
  text2: '#4a5878',
  line: 'rgba(15,39,71,0.16)',
  surface: '#f8fafc',
  accent: '#e85d56',
  sequential: ['#dce6f3', '#2c62a8'],
  fontFamily: 'system-ui, sans-serif',
};

/** Chart colours read from the CSS tokens; updates when the theme or contrast changes. */
export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, read, () => fallback);
}
