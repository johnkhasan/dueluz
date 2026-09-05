#!/usr/bin/env node
/**
 * Creates a local .env from .env.example and fills every secret placeholder
 * with freshly generated random values. Never overwrites an existing .env.
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

if (existsSync(envPath)) {
  console.log('.env already exists — leaving it untouched.');
  process.exit(0);
}

copyFileSync(examplePath, envPath);
const secret = () => randomBytes(32).toString('base64url');
const contents = readFileSync(envPath, 'utf8')
  .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret()}`)
  .replace(/^ANON_SECRET=.*$/m, `ANON_SECRET=${secret()}`)
  .replace(/^IP_SALT=.*$/m, `IP_SALT=${secret()}`);

writeFileSync(envPath, contents);
console.log('.env created with freshly generated secrets.');
