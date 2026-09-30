/**
 * Wipes the project back to a clean state and creates one administrator.
 *
 * The operator confirmed this is a test rebuild: the existing rows were demo
 * data, and they want an empty system to start from. Nothing here is reversible,
 * so the script refuses to run unless it is passed an explicit confirmation flag.
 *
 * What it removes: every document in every collection, the Appwrite accounts
 * that belonged to the old staff records, and the subscriber credential hashes
 * that referenced the removed customers.
 *
 * What it keeps: the database, the collections, the teams and the area teams.
 * Those are the shape of the application, not data, and the new administrator
 * needs somewhere to record their areas.
 */
import config, { assertConfigValid } from '../server/config';
import { COLLECTIONS, listDocuments, deleteDocument, appwriteRequest } from '../server/appwrite-rest';
import { credentialCollectionId } from '../server/subscriber-credentials';
import { createUser, setUserLabels, addUserToTeam, findUserByEmail, STAFF_TEAM_ID, ADMIN_TEAM_ID, areaTeamId } from '../server/appwrite-rest';

assertConfigValid();

const CONFIRM = process.argv[2] === '--confirm';
if (!CONFIRM) {
  console.error('Refusing to run without --confirm.');
  console.error('This deletes every record in the project permanently.');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.NEW_ADMIN_EMAIL?.trim();
const ADMIN_PASSWORD = process.env.NEW_ADMIN_PASSWORD ?? '';
const ADMIN_NAME = process.env.NEW_ADMIN_NAME?.trim() || 'Administrator';

if (!ADMIN_EMAIL) {
  console.error('NEW_ADMIN_EMAIL is required.');
  process.exit(1);
}

// The provision script enforces a minimum length. This script cannot set a
// shorter one through it, but it is the reset path an operator uses while
// testing, so it only warns rather than refusing, and says so plainly.
if (ADMIN_PASSWORD.length < 12) {
  console.log(
    `\n  WARNING: the password is ${ADMIN_PASSWORD.length} characters.\n` +
      '           "npm run provision" requires at least 12 and will reject this.\n' +
      '           It works for sign-in; change it before real use.\n'
  );
}

const summary: Array<[string, number]> = [];

for (const [key, collectionId] of Object.entries(COLLECTIONS)) {
  const rows = await listDocuments<{ id: string }>(collectionId, { limit: 5000 });
  let removed = 0;
  for (const row of rows) {
    if (!row?.id) continue;
    await deleteDocument(collectionId, row.id);
    removed += 1;
  }
  summary.push([key, removed]);
}

console.log('Records removed:');
for (const [key, count] of summary) {
  if (count > 0) console.log(`  ${key.padEnd(18)} ${count}`);
}
const total = summary.reduce((sum, [, n]) => sum + n, 0);
console.log(`  ${'TOTAL'.padEnd(18)} ${total}\n`);

// Credential hashes live in their own server-only collection.
const credentials = await listDocuments<{ id: string }>(credentialCollectionId, { limit: 5000 });
for (const row of credentials) {
  if (row?.id) await deleteDocument(credentialCollectionId, row.id);
}
if (credentials.length > 0) {
  console.log(`  subscriber_credentials ${credentials.length} credential hash(es) removed\n`);
}

// The old Appwrite accounts, so they cannot still sign in.
const staffRows = await listDocuments<{ email?: string }>(COLLECTIONS.staff, { limit: 5000 });
let accounts = 0;
for (const row of staffRows) {
  if (!row.email) continue;
  const user = await findUserByEmail(row.email);
  if (!user) continue;
  await appwriteRequest({ method: 'DELETE', path: `/users/${user.$id}` });
  accounts += 1;
}
if (accounts > 0) console.log(`  ${accounts} old Appwrite account(s) removed\n`);

// The one administrator, created the way provision would have.
const existing = await findUserByEmail(ADMIN_EMAIL);
if (existing) {
  console.log(`An Appwrite account already exists for ${ADMIN_EMAIL}.`);
  process.exit(1);
}

const user = await createUser({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  name: ADMIN_NAME,
  labels: ['trigon', 'roleadmin'],
});

await upsertStaff(ADMIN_EMAIL, ADMIN_NAME, user.$id);
await addUserToTeam(STAFF_TEAM_ID, ADMIN_EMAIL, ['admin']);
await addUserToTeam(ADMIN_TEAM_ID, ADMIN_EMAIL, ['admin']);

// Every area team, so the administrator can see the whole network.
for (const area of await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 5000 })) {
  if (area?.id) await addUserToTeam(areaTeamId(area.id), ADMIN_EMAIL, ['admin']);
}

async function upsertStaff(email: string, name: string, accountId: string): Promise<void> {
  const { upsertDocument } = await import('../server/appwrite-rest');
  const id = 'staff-admin';
  const areas = (await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 5000 })).map(
    (a) => a.id
  );
  await upsertDocument(COLLECTIONS.staff, id, {
    id,
    name,
    email,
    emailLower: email.toLowerCase(),
    role: 'Admin',
    status: 'active',
    accountId,
    allAreas: true,
    allowedSections: [],
    allowedFunctions: [],
    assignedAreaIds: areas,
  });
}

console.log('Administrator created:');
console.log(`  email    : ${ADMIN_EMAIL}`);
console.log(`  password : ${ADMIN_PASSWORD}`);
console.log('  Change this password before using the system for real.');
console.log(`\nSign in at http://localhost:${config.port}`);
void setUserLabels;
