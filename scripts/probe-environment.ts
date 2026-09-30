/**
 * Pre-flight: is the Appwrite project reachable and provisioned?
 * Read-only. Reports state, changes nothing.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments, appwriteRequest, AppwriteRestError } from '../server/appwrite-rest';

assertConfigValid();

console.log('endpoint :', config.appwrite.endpoint);
console.log('project  :', config.appwrite.projectId);
console.log('database :', config.appwrite.databaseId);

for (const [key, id] of Object.entries(COLLECTIONS)) {
  try {
    const rows = await listDocuments(id, { limit: 1 });
    let count: number | string = '>0';
    try {
      const full = await listDocuments(id, { limit: 5000 });
      count = full.length;
    } catch {
      /* keep >0 */
    }
    console.log(`  ${key.padEnd(18)} ${id.padEnd(18)} rows=${count}`);
  } catch (error) {
    const status = error instanceof AppwriteRestError ? error.status : 'network';
    console.log(`  ${key.padEnd(18)} ${id.padEnd(18)} ERROR ${status}`);
  }
}

try {
  const staff = await listDocuments<{ id: string; email: string; role?: string; assignedAreaIds?: string[] }>(
    COLLECTIONS.staff,
    { limit: 50 }
  );
  console.log('\nstaff records:');
  for (const row of staff) {
    console.log(
      `  ${row.id}  ${row.email}  role=${row.role ?? '-'}  areas=${JSON.stringify(row.assignedAreaIds ?? [])}`
    );
  }
} catch (error) {
  console.log('could not list staff:', error instanceof Error ? error.message : error);
}

try {
  const areas = await listDocuments<{ id: string; name: string }>(COLLECTIONS.areas, { limit: 50 });
  console.log('\nareas:');
  for (const a of areas) console.log(`  ${a.id}  ${a.name}`);
} catch {
  console.log('\nareas: unavailable');
}
