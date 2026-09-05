-- Telegram-only authentication.
--
-- Sign-in is a verified Telegram account, so the password column has no reader
-- left and is dropped rather than kept as an unused secret at rest. `email`
-- becomes optional: Telegram never gives us one.
--
-- `telegram_id` is nullable so accounts that predate this migration keep
-- working as content authors; they simply have no way to sign in until the
-- account is linked to a Telegram user.

ALTER TABLE "users" ADD COLUMN "telegram_id" TEXT;
ALTER TABLE "users" ADD COLUMN "telegram_username" TEXT;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" DROP COLUMN "password_hash";

-- Postgres treats NULLs as distinct, so every unlinked account is allowed.
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- Every session was minted against a password login that no longer exists.
DELETE FROM "sessions";
