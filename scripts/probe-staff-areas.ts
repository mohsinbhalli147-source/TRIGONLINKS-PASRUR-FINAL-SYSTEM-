/**
 * Staff area audit (READ ONLY).
 *
 * Fail-closed write authorization means a staff account with no assignedAreaIds
 * cannot create or edit any area-scoped record. This lists every staff account
 * with its role and current areas, plus the areas available to assign, so the
 * gap can be reviewed. It changes nothing.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments } from '../server/appwrite-rest';

assertConfigValid();

const [staffRows, areaRows] = await Promise.all([
  listDocuments<Record<string, any>>(COLLECTIONS.staff, { limit: 5000 }),
  listDocuments<Record<string, any>>(COLLECTIONS.areas, { limit: 5000 }),
]);

console.log(`Project: ${config.appwrite.projectId}`);
console.log(`\nAVAILABLE AREAS (${areaRows.length}):`);
for (const a of areaRows) {
  console.log(`  ${String(a.id).padEnd(10)} ${a.name || ''} ${a.code ? `(${a.code})` : ''}`);
}

console.log(`\nSTAFF ACCOUNTS (${staffRows.length}):`);
const needsAreas: Array<Record<string, any>> = [];
for (const s of staffRows) {
  const areas = Array.isArray(s.assignedAreaIds) ? s.assignedAreaIds : [];
  const isAdmin = s.role === 'Admin';
  const flag = isAdmin ? 'ADMIN' : areas.length === 0 ? 'NO AREAS' : 'ok';
  console.log(
    `  ${String(s.id).padEnd(24)} ${String(s.email || '').padEnd(30)} role=${String(s.role).padEnd(11)} areas=[${areas.join(',')}] ${flag}`
  );
  if (!isAdmin && areas.length === 0) needsAreas.push(s);
}

console.log(`\nSTAFF WITH NO AREAS (${needsAreas.length}):`);
for (const s of needsAreas) {
  console.log(
    `  ${s.email}  name="${s.name}"  role=${s.role}  sections=[${(s.allowedSections || []).join(',')}]`
  );
}

console.log('\nThis report made no changes.');
