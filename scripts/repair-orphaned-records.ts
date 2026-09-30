/**
 * Repairs rows that no staff member can see.
 *
 * A row's permission list names an area team, not a person. A record written
 * with no resolvable area therefore grants nothing, and the staff panel filters
 * it out - a filed complaint looks like it was never filed. This rewrites those
 * rows, inheriting the area from the customer they belong to, and reports what
 * it changed. Safe to re-run.
 */
import { assertConfigValid } from '../server/config';
import {
  COLLECTIONS,
  listDocuments,
  getDocument,
  upsertDocument,
  permissionsForArea,
  type CollectionKey,
} from '../server/appwrite-rest';

assertConfigValid();

const customers = await listDocuments<{ id: string; areaId?: string }>(COLLECTIONS.customers, {
  limit: 5000,
});
const customerArea = new Map<string, string | null>(
  customers.map((c) => [c.id, c.areaId ?? null])
);

const FALLBACK_AREA = process.env.REPAIR_FALLBACK_AREA ?? 'area-pasrur';

let totalRepaired = 0;

for (const [key, collectionId] of [
  ['complaints', COLLECTIONS.complaints],
  ['invoices', COLLECTIONS.invoices],
  ['connections', COLLECTIONS.connections],
  ['expenses', COLLECTIONS.expenses],
] as const) {
  const rows = await listDocuments<Record<string, unknown>>(collectionId, { limit: 5000 });
  let repaired = 0;

  for (const row of rows) {
    const id = String(row.id ?? '');
    if (!id) continue;

    const direct = (row.areaId as string | undefined) ?? null;
    if (direct) continue;

    const viaCustomer = row.customerId
      ? (customerArea.get(String(row.customerId)) ?? null)
      : null;
    const areaId = viaCustomer ?? FALLBACK_AREA;

    const existing = (await getDocument<Record<string, unknown>>(collectionId, id)) ?? row;
    await upsertDocument(
      collectionId,
      id,
      { ...existing, id, areaId },
      permissionsForArea(areaId, collectionId as CollectionKey)
    );
    repaired += 1;
    console.log(
      `  ${key}/${id} -> ${areaId} (${viaCustomer ? 'from customer' : 'fallback'})`
    );
  }

  if (repaired > 0) console.log(`${key}: repaired ${repaired}\n`);
  totalRepaired += repaired;
}

console.log(`\n${totalRepaired} record(s) repaired. Staff can now see them.`);
