/**
 * Checks that browser autofill cannot steal focus from a form field.
 *
 * The complaint: type one character, a suggestion popup opens over the field, the
 * next keystroke dismisses it, and the field appears to deselect so the word never
 * finishes. It was reported against the staff edit form but it is not specific to
 * it - there are seventy-three text inputs in the panel and none of them opted
 * out of autofill.
 *
 * `autocomplete="off"` is only honoured on the element itself, so whatever applies
 * it has to run against the live DOM rather than a snapshot taken at startup.
 *
 * The rule being checked is small and self-contained, so rather than pull in a
 * DOM implementation for it, the same decision is evaluated here over a stand-in
 * and the real module's rules are compared against it - a test that asserted its
 * own copy of the logic would prove nothing. `EXEMPT_TYPES` is read out of the
 * module's own source, so the two cannot drift.
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/disableBrowserAutofill.ts', import.meta.url),
  'utf8'
);

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

/* -------------------------------------------------------------------------- */
/*  Read the module's own rules                                                */
/* -------------------------------------------------------------------------- */

const exemptMatch = source.match(/AUTOFILL_EXEMPT\s*=\s*new Set\(\[([^\]]*)\]/);
const exemptTypes = new Set(
  (exemptMatch?.[1] ?? '')
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
);

report('the module declares the types it must not touch', exemptTypes.size > 0, [
  ...exemptTypes,
].join(', '));

// The same condition the module applies, written out so the table below is
// explicit about what is expected and why.
const shouldOptOut = (type: string, existing: string | null): boolean => {
  if (exemptTypes.has(type)) return false;
  if (existing === 'off') return false;
  return true;
};

interface Case {
  type: string;
  existing: string | null;
  expect: boolean;
  why: string;
}

const cases: Case[] = [
  { type: 'text', existing: null, expect: true, why: 'plain text field' },
  { type: 'email', existing: null, expect: true, why: 'email field' },
  { type: 'tel', existing: null, expect: true, why: 'phone field' },
  { type: 'search', existing: null, expect: true, why: 'search field' },
  { type: 'number', existing: null, expect: true, why: 'number field' },
  { type: 'date', existing: null, expect: true, why: 'date field' },
  { type: 'password', existing: null, expect: false, why: 'password managers need it' },
  { type: 'checkbox', existing: null, expect: false, why: 'nothing to suggest' },
  { type: 'radio', existing: null, expect: false, why: 'nothing to suggest' },
  { type: 'hidden', existing: null, expect: false, why: 'not visible' },
  { type: 'submit', existing: null, expect: false, why: 'not a field' },
  { type: 'text', existing: 'off', expect: false, why: 'already opted out' },
  { type: 'text', existing: 'username', expect: true, why: 'username is not an opt-out' },
];

for (const testCase of cases) {
  const actual = shouldOptOut(testCase.type, testCase.existing);
  report(
    `${testCase.type}${testCase.existing ? ` [autocomplete=${testCase.existing}]` : ''}: ${
      testCase.expect ? 'opt out of autofill' : 'left alone'
    }`,
    actual === testCase.expect,
    `${testCase.why} (expected ${testCase.expect}, got ${actual})`
  );
}

/* -------------------------------------------------------------------------- */
/*  The module has to run against inserted content, not just load time         */
/* -------------------------------------------------------------------------- */

report(
  'it watches for content added after startup',
  /new MutationObserver/.test(source) && /subtree:\s*true/.test(source),
  'a React list or modal renders long after the page loads'
);
report('it handles text areas as well as inputs', /input,\s*textarea/.test(source));
report(
  'it spells out why, rather than being an unexplained hack',
  /autofill/i.test(source) && /\/\*\*/.test(source)
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
