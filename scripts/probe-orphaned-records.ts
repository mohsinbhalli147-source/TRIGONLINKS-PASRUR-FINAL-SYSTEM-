/**
 * Reports the area assignment on records that need one to become visible.
 *
 * A complaint, invoice or connection is only shown to staff when the browser can
 * resolve its area, and the area is taken from the record or from its customer.
 * A record with no area is not "visible to everyone", it is visible to nobody:
 * the row permission list was written with no area team, so the staff panel
 * filters it out and it looks like the ticket was never filed.
 *
 * Read only.
 */
import { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments } from '../server/appwrite-rest';

assertConfigValid();

const areas = await listDocuments<{ id: string; name?: string }>(COLLECTIONS.areas, { limit: 500 });
const areaNames = new Map(areas.map((a) => [a.id, a.name ?? a.id]));

console.log(`Areas: ${areas.length}`);
for (const a of areas) console.log(`  ${a.id.padEnd(14)} ${a.name ?? ''}`);

const customers = await listDocuments<{ id: string; areaId?: string; name?: string }>(
  COLLECTIONS.customers,
  { limit: 500 }
);
const customerArea = new Map(customers.map((c) => [c.id, c.areaId]));

console.log(`\nCustomers: ${customers.length}`);
for (const c of customers) {
  console.log(
    `  ${c.id.padEnd(12)} area=${c.areaId ?? '(none)'.padEnd(12)} ${c.areaId ? areaNames.get(c.areaId) ?? 'unknown area' : '<-- WILL NOT BE VISIBLE'}  ${c.name ?? ''}`
  );
}

for (const [key, collectionId] of [
  ['complaints', COLLECTIONS.complaints],
  ['invoices', COLLECTIONS.invoices],
  ['connections', COLLECTIONS.connections],
  ['expenses', COLLECTIONS.expenses],
] as const) {
  const rows = await listDocuments<{ id: string; areaId?: string; customerId?: string }>(
    collectionId,
    { limit: 500 }
  );
  const orphans = rows.filter((r) => {
    if (r.areaId) return false;
    // Inherits from its customer when the record itself has none.
    if (r.customerId) return !customerArea.get(r.customerId);
    return true;
  });
  console.log(
    `\n${key}: ${rows.length} row(s), ${orphans.length} with no resolvable area` +
      (orphans.length ? ` -> ${orphans.map((r) => r.id).join(', ')}` : '')
  );
}

console.log('\nThis report changed nothing.');
