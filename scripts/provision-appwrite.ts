/**
 * One-time Appwrite provisioning.
 *
 *   npm run provision
 *
 * Creates the database, the schemaless collections and their attributes, the
 * staff team that guards every operational collection, and the Appwrite
 * accounts that own the passwords. Safe to re-run: every step checks first.
 *
 * Generated passwords are written once to provisioning-credentials.txt, which is
 * gitignored. Delete it after distributing the passwords.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import config, { ROOT_DIR, assertConfigValid } from '../server/config';
import {
  COLLECTIONS,
  STAFF_TEAM_ID,
  ADMIN_TEAM_ID,
  AppwriteRestError,
  addUserToTeam,
  appwriteRequest,
  appwriteLabelsFor,
  areaTeamId,
  createTeam,
  createUser,
  findTeam,
  findUserByEmail,
  getDocument,
  listDocuments,
  listTeamMemberships,
  permissionsForArea,
  setDocumentPermissions,
  setUserLabels,
  upsertDocument,
} from '../server/appwrite-rest';
import {
  credentialCollectionId,
  hashCnic,
  isPlausibleCnic,
  normaliseCnic,
} from '../server/subscriber-credentials';

assertConfigValid();

const endpoint = config.appwrite.endpoint;
const projectId = config.appwrite.projectId;
const databaseId = config.appwrite.databaseId;
const dbPath = `/databases/${databaseId}`;

/**
 * Collection-level permissions: READ-ONLY, for everyone.
 *
 * There is no `create` grant on purpose. Appwrite requires a collection-level
 * `create` permission before a client may create a document at all, so without
 * this a staff member's own Appwrite session could still create rows directly in
 * any collection, bypassing the server's write policy entirely. Combined with
 * rows that grant only `read` (see permissionsForArea), a browser cannot create,
 * update or delete a single document in this database.
 *
 * Everything that mutates data now goes through the server at /api/data, which
 * checks role, section, function and area before writing with the API key.
 *
 * Read is admin-only at the collection level: staff read through the per-document
 * permissions set on each row, which is what makes area scoping enforceable
 * rather than cosmetic.
 */
const COLLECTION_PERMISSIONS = ['read("team:trigon_admin")'];

const log = (message: string) => console.log(`  ${message}`);

async function exists(method: 'GET', apiPath: string): Promise<boolean> {
  try {
    await appwriteRequest({ method, path: apiPath });
    return true;
  } catch (error) {
    if (error instanceof AppwriteRestError && (error.status === 404 || error.status === 409)) {
      return false;
    }
    throw error;
  }
}

async function ensureDatabase(): Promise<void> {
  if (await exists('GET', dbPath)) {
    log(`database "${databaseId}" already exists`);
    return;
  }
  await appwriteRequest({
    method: 'POST',
    path: '/databases',
    body: { databaseId, name: 'Trigon Links ISP' },
  });
  log(`created database "${databaseId}"`);
}

async function ensureCollection(collectionId: string): Promise<void> {
  const collectionPath = `${dbPath}/collections/${collectionId}`;
  if (!(await exists('GET', collectionPath))) {
    await appwriteRequest({
      method: 'POST',
      path: `${dbPath}/collections`,
      body: {
        collectionId,
        name: collectionId.replace(/_/g, ' '),
        // Per-row permissions are what scope reads by area.
        documentSecurity: true,
        permissions: COLLECTION_PERMISSIONS,
      },
    });
    log(`created collection "${collectionId}"`);
  } else {
    // Tighten an existing collection created by an earlier version, which
    // granted read("team:staff") on every row.
    await appwriteRequest({
      method: 'PUT',
      path: `${collectionPath}`,
      body: { permissions: COLLECTION_PERMISSIONS, documentSecurity: true },
    });
    log(`collection "${collectionId}" permissions tightened`);
  }

  // Schemaless payload column.
  if (!(await exists('GET', `${collectionPath}/attributes/data`))) {
    await appwriteRequest({
      method: 'POST',
      path: `${collectionPath}/attributes/string`,
      body: { key: 'data', size: 65535, required: false, default: '' },
    });
    log(`  + attribute data`);
  }

  // Indexed identifier so a record can be found without scanning the payload.
  if (!(await exists('GET', `${collectionPath}/attributes/recordId`))) {
    await appwriteRequest({
      method: 'POST',
      path: `${collectionPath}/attributes/string`,
      body: { key: 'recordId', size: 128, required: false, default: '' },
    });
    log(`  + attribute recordId`);
  }

  // Appwrite indexes asynchronously; give it a moment before the next check.
  await new Promise((resolve) => setTimeout(resolve, 400));
}

async function ensureCredentialCollection(): Promise<void> {
  const collectionPath = `${dbPath}/collections/${credentialCollectionId}`;

  if (!(await exists('GET', collectionPath))) {
    await appwriteRequest({
      method: 'POST',
      path: `${dbPath}/collections`,
      body: {
        collectionId: credentialCollectionId,
        name: 'Subscriber Credentials',
        documentSecurity: true,
        // Deliberately empty: no team or user role may touch this collection.
        // Every hash here is readable only with the server API key.
        permissions: [],
      },
    });
    log(`created collection "${credentialCollectionId}" (server-only)`);
  } else {
    // A previous run may have left it readable; tighten it again.
    await appwriteRequest({
      method: 'PUT',
      path: collectionPath,
      body: { permissions: [] },
    });
    log(`collection "${credentialCollectionId}" locked to server-only access`);
  }

  // Same schemaless shape as every other collection, or writes are rejected.
  if (!(await exists('GET', `${collectionPath}/attributes/data`))) {
    await appwriteRequest({
      method: 'POST',
      path: `${collectionPath}/attributes/string`,
      body: { key: 'data', size: 65535, required: false, default: '' },
    });
    log(`  + attribute data`);
  }
  if (!(await exists('GET', `${collectionPath}/attributes/recordId`))) {
    await appwriteRequest({
      method: 'POST',
      path: `${collectionPath}/attributes/string`,
      body: { key: 'recordId', size: 128, required: false, default: '' },
    });
    log(`  + attribute recordId`);
  }
}

async function ensureStaffTeam(): Promise<void> {
  if (await findTeam(STAFF_TEAM_ID)) {
    log(`team "${STAFF_TEAM_ID}" already exists`);
  } else {
    await createTeam(STAFF_TEAM_ID, 'Trigon Links Staff', ['admin', 'staff', 'billing']);
    log(`created team "${STAFF_TEAM_ID}"`);
  }

  if (await findTeam(ADMIN_TEAM_ID)) {
    log(`team "${ADMIN_TEAM_ID}" already exists`);
  } else {
    await createTeam(ADMIN_TEAM_ID, 'Trigon Links Administrators', ['admin']);
    log(`created team "${ADMIN_TEAM_ID}"`);
  }
}

/** One team per service area, so document permissions can name it. */
async function ensureAreaTeams(): Promise<string[]> {
  let areas: Array<{ id: string; name: string }> = [];
  try {
    areas = await listDocuments<{ id: string; name: string }>(COLLECTIONS.areas, { limit: 5000 });
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 404) {
      log('no areas collection yet - skipping area teams');
      return [];
    }
    throw error;
  }

  const ids: string[] = [];
  for (const area of areas) {
    if (!area?.id) continue;
    const teamId = areaTeamId(area.id);
    ids.push(teamId);
    if (!(await findTeam(teamId))) {
      await createTeam(teamId, `Area: ${area.name ?? area.id}`, ['staff']);
    }
  }
  log(`${ids.length} area team(s) ready`);
  return ids;
}

/** Adds each staff member to the area teams their record assigns them to. */
async function assignAreaMemberships(): Promise<void> {
  let staffRows: Array<{ id: string; email: string; role?: string; assignedAreaIds?: string[] }> = [];
  try {
    staffRows = await listDocuments(COLLECTIONS.staff, { limit: 5000 });
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 404) return;
    throw error;
  }

  for (const row of staffRows) {
    if (!row?.email) continue;
    const isAdmin = row.role === 'Admin';

    let areas: string[] = [];
    if (isAdmin) {
      // Administrators see everything, so they join every area team.
      const areaRows = await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 5000 });
      areas = areaRows.map((a) => a.id).filter(Boolean);
    } else {
      areas = (row.assignedAreaIds ?? []).filter(Boolean);
    }

    let user = await findUserByEmail(row.email);
    if (!user) {
      log(`skipping team assignment for ${row.email}: account not provisioned`);
      continue;
    }

    const membershipCache = new Map<string, Set<string>>();
    for (const areaId of areas) {
      const teamId = areaTeamId(areaId);
      let members = membershipCache.get(teamId);
      if (!members) {
        members = new Set((await listTeamMemberships(teamId)).map((m) => m.userId));
        membershipCache.set(teamId, members);
      }
      if (members.has(user.$id)) continue;
      try {
        await addUserToTeam(teamId, row.email, isAdmin ? ['admin'] : ['staff']);
        members.add(user.$id);
        log(`  ${row.email} -> ${teamId}`);
      } catch (error) {
        console.warn(`    could not add ${row.email} to ${teamId}:`, error instanceof Error ? error.message : error);
      }
    }
  }
}

/**
 * Removes the fields the decoder adds, so writing a record back does not bake
 * synthetic `createdAt`/`updatedAt` values into the stored payload.
 */
function stripInternalFields<T extends { id?: string; createdAt?: string; updatedAt?: string }>(
  row: T
): Omit<T, 'createdAt' | 'updatedAt'> {
  const { createdAt: _c, updatedAt: _u, ...rest } = row as T & Record<string, unknown>;
  return rest as Omit<T, 'createdAt' | 'updatedAt'>;
}

/**
 * Backfills per-document permissions on rows created before area teams existed.
 * Without this they would be invisible to every operator, because the collection
 * itself is now admin-read-only.
 */
async function backfillDocumentPermissions(): Promise<void> {
  const areaBearing = new Set<string>([
    COLLECTIONS.customers,
    COLLECTIONS.connections,
    COLLECTIONS.invoices,
    COLLECTIONS.payments,
    COLLECTIONS.expenses,
  ]);

  let repaired = 0;

  for (const collectionId of Object.values(COLLECTIONS)) {
    let rows: Array<{ id: string; areaId?: string }> = [];
    try {
      rows = await listDocuments(collectionId, { limit: 5000 });
    } catch (error) {
      if (error instanceof AppwriteRestError) continue;
      throw error;
    }

    for (const row of rows) {
      if (!row?.id) continue;
      const areaId = areaBearing.has(collectionId) ? (row.areaId ?? null) : null;
      try {
        // Permissions travel with the row data, so the existing payload is
        // written back unchanged. Rewriting with a blank body would erase the
        // record.
        await setDocumentPermissions(
          collectionId,
          row.id,
          stripInternalFields(row),
          permissionsForArea(areaId, collectionId)
        );
        repaired += 1;
      } catch (error) {
        console.warn(
          `  could not set permissions on ${collectionId}/${row.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  log(`applied row permissions to ${repaired} record(s)`);
}

/**
 * Uniformly random characters from an alphabet, without modulo bias.
 *
 * `byte % alphabet.length` only spreads evenly when the alphabet length divides
 * 256. This one has 57 characters and 256 = 4 * 57 + 28, so bytes 0-27 mapped to
 * their character five times while bytes 28-255 mapped to theirs four times: the
 * first 28 characters of the alphabet were about 25% more likely than the rest.
 *
 * Bytes at or above the largest whole multiple of the length that still fits in
 * a byte are thrown away and redrawn, which is what evens the distribution out.
 * The rejection rate here is 28/256, roughly one draw in nine.
 */
function randomChars(alphabet: string, count: number): string {
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  const out: string[] = [];
  while (out.length < count) {
    for (const byte of crypto.randomBytes(count)) {
      if (byte < limit) out.push(alphabet[byte % alphabet.length]);
      if (out.length === count) break;
    }
  }
  return out.join('');
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const chars = randomChars(alphabet, 20);
  return `Tg-${chars.slice(0, 4)}-${chars.slice(4, 10)}-${chars.slice(10, 16)}`;
}

const issued: Array<{ email: string; password: string; who: string }> = [];

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role?: string;
  status?: string;
  accountId?: string;
  username?: string;
}

interface CustomerRow {
  id: string;
  name: string;
  status?: string;
  accountId?: string;
  email?: string;
  username?: string;
  mobile?: string;
  cnic?: string;
}

async function ensureAccount(input: {
  email: string;
  name: string;
  who: string;
  role: 'Admin' | 'Staff' | 'Customer';
  entityId: string;
  addToStaffTeam: boolean;
}): Promise<string> {
  const labels = appwriteLabelsFor({
    role: input.role,
    entityId: input.entityId,
  });
  const existing = await findUserByEmail(input.email);
  let userId: string;

  if (existing) {
    userId = existing.$id;
    await setUserLabels(userId, labels);
    log(`account exists for ${input.email}`);
  } else {
    const password = generatePassword();
    const created = await createUser({
      email: input.email,
      password,
      name: input.name,
      labels,
    });
    userId = created.$id;
    issued.push({ email: input.email, password, who: input.who });
    log(`created account for ${input.email}`);
  }

  if (input.addToStaffTeam) {
    const memberships = await listTeamMemberships(STAFF_TEAM_ID);
    if (!memberships.some((m) => m.userId === userId)) {
      await addUserToTeam(STAFF_TEAM_ID, input.email, input.role === 'Admin' ? ['admin'] : ['staff']);
      log(`  + added to ${STAFF_TEAM_ID}`);
    }
  }

  return userId;
}

async function provisionAdmin(): Promise<void> {
  const email = config.bootstrap.adminEmail;
  const password = config.bootstrap.adminPassword;
  if (!email) {
    log('ADMIN_EMAIL not set - skipping administrator bootstrap');
    return;
  }
  if (!password) {
    throw new Error(
      'ADMIN_INITIAL_PASSWORD is required when ADMIN_EMAIL is set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(12).toString(\'base64url\'))"'
    );
  }
  if (password.length < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD must be at least 12 characters.');
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    log(`administrator ${email} already exists - leaving password untouched`);
    await setUserLabels(
      existing.$id,
      appwriteLabelsFor({ role: 'Admin', entityId: 'admin-001', staffId: 'admin-001' })
    );
    return;
  }

  const created = await createUser({
    email,
    password,
    name: config.bootstrap.adminName,
    labels: appwriteLabelsFor({ role: 'Admin', entityId: 'admin-001', staffId: 'admin-001' }),
  });
  issued.push({ email, password, who: `${config.bootstrap.adminName} (administrator)` });
  await addUserToTeam(STAFF_TEAM_ID, email, ['admin']);
  log(`created administrator ${email} (${created.$id})`);
}

async function provisionStaff(): Promise<void> {
  let rows: StaffRow[];
  try {
    rows = await listDocuments<StaffRow>(COLLECTIONS.staff, { limit: 5000 });
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 404) {
      log('no staff collection yet - skipping staff migration');
      return;
    }
    throw error;
  }

  for (const row of rows) {
    if (!row.email) {
      log(`skipping staff "${row.name ?? row.id}": no email address`);
      continue;
    }
    if (row.accountId) {
      log(`staff ${row.email} already linked to an account`);
      continue;
    }

    const isAdmin = row.role === 'Admin';
    const accountId = await ensureAccount({
      email: row.email,
      name: row.name ?? row.email,
      who: `Staff: ${row.name ?? row.email}`,
      role: isAdmin ? 'Admin' : 'Staff',
      entityId: row.id,
      addToStaffTeam: true,
    });

    // The plaintext password field must not survive the migration.
    const sanitized = { ...row, accountId } as Record<string, unknown>;
    delete sanitized.password;
    await upsertDocument(COLLECTIONS.staff, row.id, sanitized);
    log(`  linked staff record ${row.id}`);
  }
}

/**
 * Subscribers get a PBKDF2 hash of their CNIC, not an Appwrite account.
 *
 * They have no data access in Appwrite, so an account would exist only to be
 * authenticated. Storing the CNIC as a salted PBKDF2-SHA512 hash means the office
 * never keeps a second copy of a national ID in an auth system, and no Appwrite
 * user is created for every subscriber.
 */
async function provisionSubscriberCredentials(): Promise<void> {
  let rows: CustomerRow[];
  try {
    rows = await listDocuments<CustomerRow>(COLLECTIONS.customers, { limit: 5000 });
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 404) {
      log('no customers collection yet - skipping subscriber credentials');
      return;
    }
    throw error;
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row?.id) continue;
    const cnic = normaliseCnic(row.cnic);

    if (!isPlausibleCnic(cnic)) {
      skipped += 1;
      log(`skipped ${row.username ?? row.id}: no usable 13 digit CNIC on the record`);
      continue;
    }

    const existing = await getDocument<Record<string, unknown>>(
      credentialCollectionId,
      row.id
    );

    // Re-hash when the CNIC on the record has changed, otherwise the subscriber
    // would be locked out after their CNIC was corrected.
    const storedCnic = typeof existing?.cnicDigits === 'string' ? existing.cnicDigits : null;
    if (existing && storedCnic === cnic) {
      continue;
    }

    const hashed = hashCnic(cnic);
    await upsertDocument(credentialCollectionId, row.id, {
      id: row.id,
      customerId: row.id,
      cnicDigits: cnic,
      hash: hashed.hash,
      salt: hashed.salt,
      iterations: hashed.iterations,
      // Recorded so an operator can confirm which subscriber a credential
      // belongs to without the server ever holding the CNIC itself.
      userIdLabel: row.username ?? null,
      updatedAt: new Date().toISOString(),
    });
    created += 1;
  }

  log(`subscriber credentials ready (${created} written, ${skipped} skipped)`);
}
function writeCredentialsFile(): void {
  if (issued.length === 0) {
    log('no new passwords generated - nothing to hand out');
    return;
  }

  const target = path.join(ROOT_DIR, 'provisioning-credentials.txt');
  const body = [
    'TRIGON LINKS - PROVISIONED LOGIN CREDENTIALS',
    `Generated: ${new Date().toISOString()}`,
    '',
    'These passwords exist only in this file. Appwrite stores them hashed.',
    'Distribute each one to its owner, then DELETE this file.',
    '',
    ...issued.map(
      (entry) =>
        `${entry.who}\n  sign-in: ${entry.email}\n  password: ${entry.password}\n`
    ),
  ].join('\n');

  fs.writeFileSync(target, body, { encoding: 'utf8', mode: 0o600 });
  log(`\n  ${issued.length} password(s) written to ${path.basename(target)}`);
  log('  Distribute them, then delete that file immediately.');
}

async function main(): Promise<void> {
  console.log(`\nProvisioning ${projectId} at ${endpoint}\n`);

  await ensureDatabase();
  for (const collectionId of Object.values(COLLECTIONS)) {
    await ensureCollection(collectionId);
  }
  // Password hashes for subscribers. No browser role may read or write this, so
  // its collection permissions stay empty and only the server API key can read
  // it. Reusing the standard team permissions here would expose every hash.
  await ensureCredentialCollection();
  await ensureStaffTeam();
  await ensureAreaTeams();
  await provisionAdmin();
  await provisionStaff();
  await provisionSubscriberCredentials();
  await assignAreaMemberships();
  await backfillDocumentPermissions();
  writeCredentialsFile();
  await reportReadiness();

  console.log('\nDone.');
  console.log('  Staff read/write access is scoped to their assigned areas.');
  console.log('  Subscribers read only their own data through /api/portal.\n');
}

/**
 * Confirms the outcome rather than assuming it. A provisioning run that
 * "succeeded" but left the credential collection readable, or provisioned no
 * subscriber, should be obvious immediately.
 */
async function reportReadiness(): Promise<void> {
  const problems: string[] = [];

  try {
    const creds = await listDocuments<Record<string, unknown>>(credentialCollectionId, {
      limit: 5000,
    });
    log(`subscriber credentials present: ${creds.length}`);

    const unhashed = creds.filter((row) => !row.hash || !row.salt);
    if (unhashed.length > 0) {
      problems.push(`${unhashed.length} credential record(s) have no hash`);
    }
  } catch (error) {
    problems.push(
      `could not read ${credentialCollectionId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    const staff = await listDocuments<Record<string, unknown>>(COLLECTIONS.staff, { limit: 5000 });
    const noAccount = staff.filter((row) => !row.accountId);
    if (noAccount.length > 0) {
      problems.push(
        `${noAccount.length} staff record(s) have no Appwrite account and cannot sign in`
      );
    }
    log(`staff records: ${staff.length}`);
  } catch {
    problems.push('could not read the staff collection');
  }

  try {
    const customers = await listDocuments<Record<string, unknown>>(COLLECTIONS.customers, {
      limit: 5000,
    });
    log(`subscriber records: ${customers.length}`);
    if (customers.length === 0) {
      problems.push(
        'no subscriber records found. Sign in to the admin panel once so its ' +
          'cache syncs to Appwrite, then run this again.'
      );
    }
  } catch {
    problems.push('could not read the customers collection');
  }

  if (problems.length > 0) {
    console.log('\n  Readiness problems:');
    for (const problem of problems) console.log(`    - ${problem}`);
  } else {
    console.log('\n  Readiness check passed.');
  }
}

main().catch((error) => {
  if (error instanceof AppwriteRestError) {
    console.error(`\nAppwrite rejected the request (${error.status}): ${error.message}\n`);
  } else {
    console.error('\nProvisioning failed:', error instanceof Error ? error.message : error, '\n');
  }
  if (error instanceof Error && error.stack) {
    console.error(error.stack, '\n');
  }
  process.exit(1);
});


