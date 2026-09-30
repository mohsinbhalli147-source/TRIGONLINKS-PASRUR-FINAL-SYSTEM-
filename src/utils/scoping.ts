import type { Customer, ConnectionRequest, Area, AuthUser } from '../types';

/**
 * Area scoping.
 *
 * Enforcement lives in Appwrite: each document carries per-row permissions
 * naming its area team, and a technician is only a member of the teams for the
 * areas assigned to them (see scripts/provision-appwrite.ts). Team membership
 * cannot be granted by a client, so this is a real boundary.
 *
 * The helpers here are defence in depth and presentation: they narrow the
 * default view to the signed-in user's areas so the UI matches what the data
 * layer already returns, and they keep records with no areaId visible to an
 * operator who would otherwise see an empty screen.
 */
export function isUnrestricted(user: Pick<AuthUser, 'role' | 'assignedAreaIds'> | null): boolean {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const assigned = user.assignedAreaIds;
  if (!assigned || assigned.length === 0) return true; // no restriction configured
  return false;
}

export function scopeToAssignedAreas<T extends { areaId?: string }>(
  rows: T[],
  user: Pick<AuthUser, 'role' | 'assignedAreaIds'> | null
): T[] {
  if (isUnrestricted(user)) return rows;
  const allowed = new Set(user?.assignedAreaIds ?? []);
  return rows.filter((row) => (row.areaId ? allowed.has(row.areaId) : false));
}

/**
 * Narrows a customer list for a staff member. Records with no area are kept
 * visible, because a legacy record with a missing areaId should not silently
 * disappear from the only screen an operator has.
 */
export function scopeCustomers(
  customers: Customer[],
  user: Pick<AuthUser, 'role' | 'assignedAreaIds'> | null
): Customer[] {
  if (isUnrestricted(user)) return customers;
  const allowed = new Set(user?.assignedAreaIds ?? []);
  return customers.filter(
    (customer) => !customer.areaId || allowed.has(customer.areaId)
  );
}

export function scopeConnections(
  connections: ConnectionRequest[],
  user: Pick<AuthUser, 'role' | 'assignedAreaIds'> | null
): ConnectionRequest[] {
  if (isUnrestricted(user)) return connections;
  const allowed = new Set(user?.assignedAreaIds ?? []);
  return connections.filter(
    (connection) => !connection.areaId || allowed.has(connection.areaId)
  );
}

export function areaNameById(areas: Area[], areaId?: string): string {
  if (!areaId) return 'Unassigned';
  return areas.find((area) => area.id === areaId)?.name ?? 'Unassigned';
}
