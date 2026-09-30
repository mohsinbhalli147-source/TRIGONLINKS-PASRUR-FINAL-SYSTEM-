/**
 * Unit checks for the subscriber credential primitives.
 *   npx tsx scripts/verify-credential-crypto.ts
 */
import { hashCnic, isPlausibleCnic, normaliseCnic, verifyCnic } from '../server/subscriber-credentials';

let failures = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${String(actual)}${ok ? '' : ` (expected ${expected})`}`);
};

// Normalisation: dashes, spaces and casing must all collapse to 13 digits, so
// a subscriber can type their CNIC the way it is printed on their ID card.
check('normalises dashed CNIC', normaliseCnic('35202-1234567-1'), '3520212345671');
check('normalises undashed CNIC', normaliseCnic('3520212345671'), '3520212345671');
check('normalises spaced CNIC', normaliseCnic(' 35202 1234567 1 '), '3520212345671');
check('rejects empty', normaliseCnic(undefined), '');
// Letters are stripped rather than rejected here, so a mistyped key still lands
// on a well-formed CNIC or is rejected by the length check. "35a02-1234567-1"
// yields 35021234567 (11 digits) and is therefore refused as implausible.
check('strips letters', normaliseCnic('35a02-1234567-1'), '350212345671');
check('that mistyped value is not plausible', isPlausibleCnic(normaliseCnic('35a02-1234567-1')), false);

check('13 digits is plausible', isPlausibleCnic('3520212345671'), true);
check('12 digits is not plausible', isPlausibleCnic('352021234567'), false);
check('14 digits is not plausible', isPlausibleCnic('35202123456712'), false);

// Round trip
const stored = hashCnic('35202-1234567-1');
check('correct CNIC verifies', verifyCnic('35202-1234567-1', stored), true);
check('undashed form also verifies', verifyCnic('3520212345671', stored), true);
check('wrong CNIC rejected', verifyCnic('35202-7654321-1', stored), false);
check('empty rejected', verifyCnic('', stored), false);

// The hash must not be the CNIC, and must not be reversible from the salt alone.
check('hash is not the CNIC', stored.hash === '3520212345671', false);
check('hash length is 64 hex chars', stored.hash.length, 64);
check('salt is present', stored.salt.length > 0, true);
check('iterations recorded', stored.iterations > 100_000, true);

// Two subscribers with the same CNIC must not share a hash (unique salts).
const other = hashCnic('35202-1234567-1');
check('same CNIC hashes differently per salt', stored.hash !== other.hash, true);
check(
  'but both still verify',
  verifyCnic('35202-1234567-1', other),
  true
);

// A corrupted record must fail closed rather than throw.
check('missing hash fails closed', verifyCnic('35202-1234567-1', { hash: '', salt: 'x', iterations: 1 }), false);
check(
  'mismatched length fails closed',
  (() => {
    try {
      return verifyCnic('35202-1234567-1', { hash: 'abcd', salt: 'x', iterations: 1 });
    } catch {
      return 'threw';
    }
  })(),
  false
);

console.log(failures === 0 ? '\nAll credential crypto checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
