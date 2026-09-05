const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Uzbek Cyrillic extras
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Apostrophe variants used in Uzbek Latin (oʻzbek, gʻalaba) carry no sound. */
const SILENT = new Set(['ʻ', 'ʼ', '‘', '’', "'"]);

/**
 * URL-safe slug. Handles Latin, Uzbek Cyrillic and Russian input because duel
 * titles arrive in all three.
 */
export function slugify(input: string, maxLength = 60): string {
  // Cyrillic is transliterated *before* NFKD: normalising first decomposes
  // "yo" into "e" + a combining diaeresis, and stripping the mark would turn
  // Dunyo into "dune". The same applies to "y" (и + breve).
  let transliterated = '';
  for (const char of input.toLowerCase()) {
    if (SILENT.has(char)) continue;
    transliterated += CYRILLIC_MAP[char] ?? char;
  }

  const normalised = transliterated.normalize('NFKD').replace(/\p{M}/gu, '');

  let out = '';
  for (const char of normalised) {
    out += /[a-z0-9]/.test(char) ? char : '-';
  }

  return out
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}

/** Short, unambiguous suffix - no vowels, so it never spells a word. */
export function slugSuffix(length = 6): string {
  const alphabet = '23456789bcdfghjkmnpqrstvwxz';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

/**
 * Duel slug: readable prefix + random suffix.
 * The suffix guarantees uniqueness without a retry loop and keeps slugs
 * non-enumerable.
 */
export function buildDuelSlug(title: string, optionA: string, optionB: string): string {
  const readable = slugify(`${optionA}-vs-${optionB}`, 50) || slugify(title, 50) || 'duel';
  return `${readable}-${slugSuffix()}`;
}

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Derives a candidate username from a Telegram profile.
 *
 * Telegram handles already share our alphabet, so they usually survive intact;
 * a user without one falls back to their transliterated first name. The result
 * is only a candidate — the caller still has to resolve collisions.
 */
export function usernameFromTelegram(handle: string | null, firstName: string): string {
  const base =
    normaliseUsername(handle ?? '') || normaliseUsername(slugify(firstName, 20)) || 'duelist';
  return base.slice(0, 14).padEnd(3, '0');
}
