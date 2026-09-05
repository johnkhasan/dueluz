import { expect, test } from '@playwright/test';

/** A real 2x2 PNG, so the server's magic-byte check and sharp both accept it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAHRUCJlOJ2AsAAAAASUVORK5CYII=',
  'base64',
);

/**
 * Registration is rate limited per IP fingerprint. Each run presents a distinct
 * forwarded address so repeated local runs get their own budget instead of
 * tripping the limiter left over from a previous run.
 */
test.use({
  extraHTTPHeaders: {
    'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
  },
});

/** The second half of the loop: a voter becomes a creator. */
test('a new user can register and publish a duel', async ({ page }) => {
  const stamp = Date.now().toString().slice(-9);
  const username = `e2e${stamp}`;

  await page.goto('/uz/register');
  await page.locator('input[name="email"]').fill(`${username}@duel.uz`);
  await page.locator('input[name="displayName"]').fill('E2E Tester');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill('Duel1234pass');
  await page.locator('form button[type="submit"]').click();

  // Sign-in performs a full navigation, so wait for the home feed to render
  // before driving the next page.
  await expect(page).toHaveURL(/\/uz$/, { timeout: 20_000 });
  await expect(page.locator('[data-testid="duel-card"]').first()).toBeVisible({ timeout: 20_000 });

  await page.goto('/uz/create');
  await page.locator('[data-testid="duel-title"]').fill(`E2E duel ${stamp}`);
  await page.locator('[data-testid="duel-option-a"]').fill(`Alpha ${stamp}`);
  await page.locator('[data-testid="duel-option-b"]').fill(`Beta ${stamp}`);

  // Scoped to <main>: the Next.js dev-tools button also matches /next/i.
  const wizard = page.locator('main');
  const next = () => wizard.getByRole('button', { name: /^(keyingi|next|далее)$/i }).click();

  await next(); // -> images

  // Upload a real image on both sides. This step exercises the whole upload
  // path (magic-byte check, sharp re-encode, storage driver) and the publish
  // payload that carries the resulting locations - a regression guard for the
  // local driver's root-relative paths being rejected by validation.
  const inputs = wizard.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await inputs.nth(1).setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG });
  await expect(wizard.locator('img[alt*="Alpha"]')).toBeVisible({ timeout: 20_000 });
  await expect(wizard.locator('img[alt*="Beta"]')).toBeVisible({ timeout: 20_000 });

  await next(); // -> details
  await next(); // -> preview

  await expect(wizard.getByText(`E2E duel ${stamp}`)).toBeVisible();
  await wizard.getByRole('button', { name: /nashr qilish|^publish$|опубликовать/i }).click();

  const viewLink = wizard.getByRole('link', { name: /duelni ko'rish|view duel|открыть дуэль/i });
  await expect(viewLink).toBeVisible({ timeout: 20_000 });

  // The published duel really shows the uploaded images, not a fallback.
  await viewLink.click();
  await expect(page).toHaveURL(/\/uz\/d\//);
  const faces = page.locator('[data-testid="duel-detail"] [data-testid="duel-side"] img');
  await expect(faces).toHaveCount(2);
  for (const src of await faces.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src),
  )) {
    expect(src).toContain('uploads');
  }

  // Let the duel page settle before navigating away, or the pending RSC
  // request cancels the next goto.
  await page.waitForLoadState('networkidle');

  // Published duels are immediately discoverable by search.
  await page.goto(`/uz/explore?q=${encodeURIComponent(`Alpha ${stamp}`)}`);
  await expect(page.getByText(`E2E duel ${stamp}`).first()).toBeVisible({ timeout: 20_000 });
});

test('creating requires an account', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/uz/create');
  await expect(page.getByRole('link', { name: /kirish|log in|войти/i }).first()).toBeVisible();
});
