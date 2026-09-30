/**
 * Checks the provisioned-password generator.
 *
 * The generator used to pick a character with `byte % alphabet.length`. That is
 * only even when the alphabet length divides 256, and this one has 57
 * characters, so the first 28 characters of the alphabet were about 25% more
 * likely than the last 29. It now rejects the leftover byte range and redraws.
 *
 * This asserts the emitted password is unchanged in shape, and measures the
 * character distribution to show the bias is gone.
 */
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const FORMAT = /^Tg-[A-Za-z0-9]{4}-[A-Za-z0-9]{6}-[A-Za-z0-9]{6}$/;

/** Kept in step with `generatePassword` in scripts/provision-appwrite.ts. */
function randomChars(alphabet: string, count: number): string {
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  const out: string[] = [];
  while (out.length < count) {
    for (const byte of crypto.randomBytes(count)) {
      if (byte < limit) out.push(alphabet[byte % alphabet.length]);
      if (out.length === count) break;
    }
  }
  return out.join('');
}

function generatePassword(): string {
  const chars = randomChars(ALPHABET, 20);
  return `Tg-${chars.slice(0, 4)}-${chars.slice(4, 10)}-${chars.slice(10, 16)}`;
}

let passed = 0;
let failed = 0;
const report = (name: string, ok: boolean, detail = ''): void => {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
};

// Shape must be identical to what the old implementation emitted, so existing
// operator instructions and the password field stay valid.
let formatOk = true;
let firstBad = '';
for (let i = 0; i < 20000; i += 1) {
  const password = generatePassword();
  if (!FORMAT.test(password)) {
    formatOk = false;
    if (!firstBad) firstBad = password;
  }
}
report('format is unchanged: Tg-XXXX-XXXXXX-XXXXXX', formatOk, formatOk ? '' : `saw "${firstBad}"`);

// Same ambiguous-character policy as before: no O/0, l/1 or I.
const allowed = new Set(ALPHABET);
const strays = new Set<string>();
for (let i = 0; i < 20000; i += 1) {
  for (const ch of generatePassword().slice(3).replace(/-/g, '')) {
    if (!allowed.has(ch)) strays.add(ch);
  }
}
report(
  'only unambiguous characters, as before',
  strays.size === 0,
  strays.size ? `unexpected: ${[...strays].join(' ')}` : ''
);

const seen = new Set<string>();
for (let i = 0; i < 50000; i += 1) seen.add(generatePassword());
report('50000 draws are all distinct', seen.size === 50000, `${seen.size} distinct`);

// Distribution. 4800000 characters gives roughly +/-1.5% of sampling noise, so a
// 2% band separates a real 25% bias from an even draw.
const DRAWS = 300000;
const counts = new Map<string, number>();
let total = 0;
for (let i = 0; i < DRAWS; i += 1) {
  for (const ch of generatePassword().slice(3).replace(/-/g, '')) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
    total += 1;
  }
}
const freqs = [...counts.values()].map((c) => c / total);
const spread = Math.max(...freqs) / Math.min(...freqs);
const ideal = 1 / ALPHABET.length;

report(
  'every alphabet character is reachable',
  counts.size === ALPHABET.length,
  `${counts.size} of ${ALPHABET.length} seen over ${total} characters`
);

// The modulo bug skews the first 28 characters against the last 29 by 5:4, so a
// correct generator must land far below 1.25x and the buggy one far above it.
// The bar is set at 1.10x: comfortably between the two, and wide enough that
// ordinary sampling noise cannot fail a correct implementation. The most-vs-least
// character over this many draws sits near 1.01-1.02x, so 1.10x leaves a wide
// margin without weakening the test - a 25% skew is not a near miss.
report(
  'no modulo bias: spread far below the 1.25x a modulo draw would show',
  spread < 1.1,
  `spread ${spread.toFixed(4)}x, min ${(Math.min(...freqs) * 100).toFixed(4)}%, max ${(
    Math.max(...freqs) * 100
  ).toFixed(4)}%, ideal ${(ideal * 100).toFixed(4)}%`
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
