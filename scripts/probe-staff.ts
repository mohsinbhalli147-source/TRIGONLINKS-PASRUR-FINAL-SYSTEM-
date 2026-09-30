/**
 * Inspects the staff records the write policy is judged against.
 * Read-only.
 */
import { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments } from '../server/appwrite-rest';
import { ALL_SECTIONS, ALL_FUNCTIONS } from '../src/types';

assertConfigValid();

const staff = await listDocuments<Record<string, unknown>>(COLLECTIONS.staff, { limit: 50 });
const areas = await listDocuments<{ id: string; name: string }>(COLLECTIONS.areas, { limit: 50 });

for (const row of staff) {
  console.log('='.repeat(70));
  console.log(`${row.id}  <${row.email}>  role=${row.role}  status=${row.status}`);
  console.log(`  assignedAreaIds : ${JSON.stringify(row.assignedAreaIds ?? [])}`);
  const sections = (row.allowedSections as string[]) ?? [];
  const functions = (row.allowedFunctions as string[]) ?? [];
  console.log(`  sections (${sections.length}/${ALL_SECTIONS.length}) : ${sections.join(', ') || '-'}`);
  console.log(`  functions (${functions.length}/${ALL_FUNCTIONS.length}): ${functions.join(', ') || '-'}`);
}

console.log('='.repeat(70));
console.log('\nAll sections:');
console.log(ALL_SECTIONS.map((s) => s.id).join(' '));
console.log('\nAll functions:');
console.log(ALL_FUNCTIONS.map((f) => f.id).join(' '));

console.log('\nCustomers per area (sample of 5):');
const customers = await listDocuments<{ id: string; name: string; areaId: string }>(
  COLLECTIONS.customers,
  { limit: 5000 }
);
const byArea = new Map<string, number>();
for (const c of customers) byArea.set(c.areaId ?? '(none)', (byArea.get(c.areaId ?? '(none)') ?? 0) + 1);
for (const [areaId, n] of byArea) {
  console.log(`  ${areaId.padEnd(16)} ${String(n).padStart(3)}  ${areas.find((a) => a.id === areaId)?.name ?? ''}`);
}
console.log('  sample:', customers.slice(0, 5).map((c) => `${c.id}/${c.areaId}`).join(', '));
