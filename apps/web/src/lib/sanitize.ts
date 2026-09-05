import { AppError } from './errors';

/**
 * User-generated text is stored and rendered as plain text - the app never
 * accepts or renders HTML, so React's own escaping is the XSS boundary.
 * This module's job is normalisation and abuse heuristics, not escaping.
 */

/**
 * Unicode "format" characters: zero-width spaces, soft hyphens, bidi
 * overrides, the BOM. They are invisible, and are used to smuggle lookalike or
 * reversed text past moderation and to fake non-empty comments.
 */
const INVISIBLE = /\p{Cf}/gu;

/** Control characters, keeping tab and newline. */
const CONTROL = /[^\P{Cc}\n\t]/gu;

export function cleanText(input: string): string {
  return input
    .replace(INVISIBLE, '')
    .replace(/\r\n/g, '\n')
    .replace(CONTROL, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line fields (titles, option names) never contain newlines. */
export function cleanLine(input: string): string {
  return cleanText(input)
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

const URL_RE = /(https?:\/\/|www\.)\S+/gi;

export function countLinks(input: string): number {
  return input.match(URL_RE)?.length ?? 0;
}

/**
 * Cheap spam heuristics for comments and duel descriptions. Deliberately
 * conservative: a false positive is worse than one more item in the report
 * queue.
 */
export function assertNotSpam(input: string, { maxLinks = 1 } = {}): void {
  if (countLinks(input) > maxLinks) {
    throw new AppError('SPAM_DETECTED', 'Too many links');
  }

  const letters = input.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 12) {
    const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
    if (upper / letters.length > 0.8) {
      throw new AppError('SPAM_DETECTED', 'Please do not write in all caps');
    }
  }

  // Long runs of one repeated character.
  if (/(.)\1{9,}/u.test(input)) {
    throw new AppError('SPAM_DETECTED', 'Repeated characters detected');
  }
}

/** Backing text for the trigram search index: lowercase, punctuation collapsed. */
export function toSearchText(parts: (string | null | undefined)[]): string {
  return cleanLine(parts.filter(Boolean).join(' '))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
