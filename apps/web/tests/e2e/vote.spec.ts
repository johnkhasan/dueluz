import { expect, test } from '@playwright/test';

/**
 * The core loop: an anonymous visitor discovers a duel, votes, and sees the
 * result. Nothing on this path may require an account.
 */
test('an anonymous visitor can vote and the result persists', async ({ page }) => {
  await page.goto('/uz');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.locator('[data-testid="duel-card"] a[href*="/d/"]').first().click();
  await expect(page).toHaveURL(/\/uz\/d\//);

  const detail = page.locator('[data-testid="duel-detail"]');
  const sides = detail.locator('[data-testid="duel-side"]');
  await expect(sides).toHaveCount(2);

  // Before voting the result is hidden - that is the whole incentive to vote.
  await expect(detail.locator('[data-testid="duel-percentage"]')).toHaveCount(0);

  const chosenName = await sides.first().getAttribute('aria-label');
  await sides.first().click();

  // Percentages come from the server response, never from a local guess.
  await expect(detail.locator('[data-testid="duel-percentage"]')).toHaveCount(2);
  await expect(sides.first()).toHaveAttribute('aria-pressed', 'true');

  // Reloading keeps the vote: it is stored server-side against the anon cookie.
  await page.reload();
  await expect(detail.locator('[data-testid="duel-side"][aria-pressed="true"]')).toHaveAttribute(
    'aria-label',
    chosenName ?? '',
  );

  // And a second vote is impossible.
  await expect(sides.first()).toBeDisabled();
});

test('voting opens the share prompt with a Telegram target', async ({ page }) => {
  await page.goto('/uz');
  await page.locator('[data-testid="duel-card"] a[href*="/d/"]').first().click();
  await page.locator('[data-testid="duel-detail"] [data-testid="duel-side"]').first().click();

  const dialog = page.locator('[data-testid="share-dialog"][open]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole('link', { name: /telegram/i })).toBeVisible();
});

test('a duel can be voted on directly from the feed', async ({ page }) => {
  await page.goto('/uz');

  const card = page.locator('[data-testid="duel-card"]').first();
  await card.locator('[data-testid="duel-side"]').first().click();

  await expect(card.locator('[data-testid="duel-percentage"]')).toHaveCount(2);
});
