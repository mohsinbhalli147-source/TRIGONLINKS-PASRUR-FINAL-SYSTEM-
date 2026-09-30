/**
 * Removes the fixtures an interrupted `verify:write-authz` run left behind.
 *
 * The verifier tracks every row it creates, but its cleanup sat on the happy
 * path, so a run that threw partway through (it did, on an Appwrite 2.3 document
 * id rejection) left rows in the live database. This only ever deletes rows
 * whose email is on the reserved `.invalid` domain, so real business data
 * cannot match.
 */
import { COLLECTIONS, listDocuments, deleteDocument } from '../server/appwrite-rest';
import config, { assertConfigValid } from '../server/config';

assertConfigValid();

const TEST_EMAIL = /@verify\.invalid$/;
let removed = 0;

for (const [key, collectionId] of Object.entries(COLLECTIONS)) {
  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = await listDocuments<Record<string, unknown>>(collectionId, { limit: 5000 });
  } catch {
    continue;
  }

  for (const row of rows) {
    const email = typeof row.email === 'string' ? row.email : '';
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id || !TEST_EMAIL.test(email)) continue;

    await deleteDocument(collectionId, id);
    removed += 1;
    console.log(`  removed ${key}/${id} (${email})`);
  }
}

console.log(`\n${removed} leftover fixture(s) removed from project ${config.appwrite.projectId}`);
