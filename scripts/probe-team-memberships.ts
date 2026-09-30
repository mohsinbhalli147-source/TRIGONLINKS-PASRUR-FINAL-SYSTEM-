/**
 * Lists every team and its members, read through the API key.
 *
 * A row is readable by a client only when the caller's session belongs to a
 * team named in that row's permission list. Repairing a row is therefore not
 * enough: if the signed-in account is not a member of the area team, the row
 * stays invisible. This separates "the row is wrong" from "the account is not in
 * the team".
 */
import { assertConfigValid } from '../server/config';
import { appwriteRequest, findUserByEmail, COLLECTIONS, listDocuments } from '../server/appwrite-rest';

assertConfigValid();

const teams = await appwriteRequest<{ teams: Array<{ $id: string; name: string }> }>({
  method: 'GET',
  path: '/teams',
});

console.log(`Teams: ${teams.teams.length}\n`);

const email = process.env.CHECK_EMAIL?.trim() || 'mohsinbhalli147@gmail.com';
const user = await findUserByEmail(email);
console.log(`Checking: ${email} (${user ? 'found' : 'NOT FOUND'})\n`);

for (const team of teams.teams) {
  const members = await appwriteRequest<{ memberships: Array<{ userId: string }> }>({
    method: 'GET',
    path: `/teams/${team.$id}/memberships`,
  });
  const isMember = user ? members.memberships.some((m) => m.userId === user.$id) : false;
  console.log(
    `  ${team.name.padEnd(34)} ${String(members.memberships.length).padStart(2)} member(s)  ${isMember ? '<-- you are here' : ''}`
  );
}

console.log('\nAreas on record:');
const areas = await listDocuments<{ id: string; name?: string }>(COLLECTIONS.areas, { limit: 100 });
for (const a of areas) console.log(`  ${a.id.padEnd(14)} ${a.name ?? ''}`);

console.log('\nThis report changed nothing.');
