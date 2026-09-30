/**
 * Creates a service area and its Appwrite team.
 *
 * Areas are not data in the ordinary sense: the billing, connection and work
 * order screens all need one, and a customer cannot be added without it. This
 * seeds a single starting area on a freshly reset project so the panel is
 * usable straight away. More can be added from the Areas screen afterwards.
 */
import config, { assertConfigValid } from '../server/config';
import {
  COLLECTIONS,
  listDocuments,
  upsertDocument,
  findTeam,
  createTeam,
  addUserToTeam,
  findUserByEmail,
  areaTeamId,
  STAFF_TEAM_ID,
} from '../server/appwrite-rest';

assertConfigValid();

if (process.argv[2] !== '--confirm') {
  console.error('Refusing to run without --confirm.');
  process.exit(1);
}

const id = process.argv[3] || 'area-pasrur';
const name = process.argv[4] || 'Pasrur City';
const code = process.argv[5] || 'PSR-01';
const city = process.argv[6] || 'Pasrur';
const adminEmail = process.env.NEW_ADMIN_EMAIL?.trim();

const existingAreas = await listDocuments<{ id: string }>(COLLECTIONS.areas, { limit: 5000 });
if (existingAreas.some((a) => a.id === id)) {
  console.log(`Area ${id} already exists. Nothing to do.`);
  process.exit(0);
}

await upsertDocument(COLLECTIONS.areas, id, {
  id,
  name,
  code,
  city,
  status: 'Active',
  customerCount: 0,
  activeComplaints: 0,
  createdAt: new Date().toISOString(),
});

const teamId = areaTeamId(id);
if (!(await findTeam(teamId))) {
  await createTeam(teamId, `Area: ${name}`, ['admin', 'staff']);
  console.log(`Team created: ${teamId}`);
}

// Put the administrator in it, so the area is usable immediately.
if (adminEmail) {
  const admin = await findUserByEmail(adminEmail);
  if (admin) {
    await addUserToTeam(teamId, adminEmail, ['admin']);
    await addUserToTeam(STAFF_TEAM_ID, adminEmail, ['admin']);
    console.log(`Administrator added to ${teamId}`);
  }
}

console.log(`\nArea created: ${name} (${id}, ${code}, ${city})`);
console.log('Add more from the Areas screen in the panel.');
void config;
