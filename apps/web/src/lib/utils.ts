import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className joiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Vote percentages that always sum to exactly 100.
 *
 * Rounding both sides independently can produce 33% / 68%. The second side
 * absorbs the remainder so the UI never shows an impossible split.
 */
export function votePercentages(a: number, b: number): [number, number] {
  const total = a + b;
  if (total <= 0) return [50, 50];
  const percentA = Math.round((a / total) * 100);
  return [percentA, 100 - percentA];
}

function isUzbek(locale: string): boolean {
  return locale.toLowerCase().startsWith('uz');
}

/**
 * Compact counts (1.2K, 12,8 ming).
 *
 * Uzbek is formatted by hand for the same reason dates are: Chromium has no
 * `uz-UZ` compact-notation data and falls back to English "12.8K" while Node
 * produces "12,8 ming", which both reads wrong and breaks hydration.
 */
export function formatCount(value: number, locale = 'en'): string {
  if (Math.abs(value) < 1000) return String(value);

  if (isUzbek(locale)) {
    const [divisor, suffix] =
      Math.abs(value) >= 1_000_000 ? ([1_000_000, 'mln'] as const) : ([1000, 'ming'] as const);
    const scaled = Math.round((value / divisor) * 10) / 10;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace('.', ',');
    return `${text} ${suffix}`;
  }

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/**
 * Uzbek is not reliably present in browser ICU data: Chromium formats
 * `uz-UZ` dates as "2026 M09 4" and falls back to English for relative times,
 * while Node renders them properly. That mismatch both looks wrong to an Uzbek
 * reader and breaks hydration, so Uzbek is formatted here by hand and the
 * Intl fallback is reserved for locales browsers actually ship.
 */
const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

const UZ_UNITS: [Intl.RelativeTimeFormatUnit, number, string][] = [
  ['year', 31_536_000, 'yil'],
  ['month', 2_592_000, 'oy'],
  ['week', 604_800, 'hafta'],
  ['day', 86_400, 'kun'],
  ['hour', 3600, 'soat'],
  ['minute', 60, 'daqiqa'],
];

function uzRelative(deltaSeconds: number): string {
  const absolute = Math.abs(deltaSeconds);
  if (absolute < 60) return 'hozirgina';

  for (const [, seconds, noun] of UZ_UNITS) {
    if (absolute >= seconds) {
      const value = Math.round(absolute / seconds);
      return deltaSeconds < 0 ? `${value} ${noun} oldin` : `${value} ${noun} keyin`;
    }
  }
  return 'hozirgina';
}

export function formatRelativeTime(date: Date | string, locale = 'en'): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const deltaSeconds = Math.round((target.getTime() - Date.now()) / 1000);

  if (isUzbek(locale)) return uzRelative(deltaSeconds);

  const absolute = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (absolute >= seconds || unit === 'second') {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return formatter.format(0, 'second');
}

export function formatDate(date: Date | string, locale = 'en'): string {
  const target = typeof date === 'string' ? new Date(date) : date;

  if (isUzbek(locale)) {
    const month = UZ_MONTHS[target.getMonth()] ?? '';
    return `${target.getDate()}-${month}, ${target.getFullYear()}`;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(target);
}

/**
 * Deterministic gradient for an option that has no image. Side A stays in the
 * violet family and side B in the rose family, matching the brand's two-sided
 * identity, while the exact hue varies per option name.
 */
export function gradientFor(seed: string, side: 'a' | 'b'): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  // Side A stays indigo-violet and side B rose-red: narrow, non-overlapping
  // bands so the two sides of a duel are never mistakable for each other.
  const spread = Math.abs(hash) % 34;
  const hue = side === 'a' ? 240 + spread : 330 + spread;
  return `linear-gradient(145deg, hsl(${hue} 78% 62%), hsl(${(hue + 24) % 360} 72% 45%))`;
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

/** Clamps a value into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
