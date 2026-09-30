/**
 * Reports what is actually stored in the live Appwrite project, per collection.
 *
 * Read only. This is the factual basis for "where does my data live" and for
 * checking that every module the panel shows actually has a backing collection.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments } from '../server/appwrite-rest';

assertConfigValid();

const SYNCED = new Set([
  'customers', 'staff', 'invoices', 'payments', 'complaints', 'connections',
  'packages', 'areas', 'inventory', 'expenses', 'announcements',
]);

const rows: Array<[string, number, boolean, string]> = [];

for (const [key, collectionId] of Object.entries(COLLECTIONS)) {
  let count = 0;
  let fields: string[] = [];
  try {
    const docs = await listDocuments<Record<string, unknown>>(collectionId, { limit: 5000 });
    count = docs.length;
    const set = new Set<string>();
    for (const d of docs) for (const f of Object.keys(d)) set.add(f);
    fields = [...set].sort();
  } catch (error) {
    rows.push([key, -1, SYNCED.has(key), `unreadable: ${error instanceof Error ? error.message : error}`]);
    continue;
  }
  rows.push([key, count, SYNCED.has(key), fields.join(', ')]);
}

console.log(`Project: ${config.appwrite.projectId}\n`);
console.log('collection        | rows | browser-synced | sample fields');
console.log('------------------|------|----------------|---------------');
for (const [key, count, synced, fields] of rows) {
  const f = fields.length > 70 ? `${fields.slice(0, 70)}...` : fields;
  console.log(
    `${key.padEnd(17)} | ${String(count).padStart(4)} | ${(synced ? 'yes' : 'NO').padEnd(14)} | ${f}`
  );
}

const unsynced = rows.filter(([k, c, s]) => c > 0 && !s);
console.log(`\nCollections holding data that the browser does NOT auto-sync:`);
if (unsynced.length === 0) console.log('  none');
for (const [key, count] of unsynced) console.log(`  ${key} (${count} rows)`);

console.log('\nThis report changed nothing.');
