import { StorageService } from '../services/storage';
import { useStorageCollections } from './useStorageCollection';

/**
 * The counters behind the sidebar badges and the navbar notification list.
 *
 * Sidebar and Navbar each declared their own `useState(0)` per counter plus an
 * identical `useEffect` re-reading the same collections off `trigon_db_updated`.
 * The filters were the same too, which meant a fix to one could silently drift
 * from the other: the sidebar counts unpaid invoices and active customers, the
 * navbar counts neither, and both were free to disagree about the four they
 * share.
 *
 * The predicates below are the single definition. Both components read from this,
 * and the subscription is inherited from `useStorageCollections`, so a count
 * cannot change in one place and not the other.
 */
export interface BadgeCounts {
  /** Complaints with status 'Pending'. */
  pendingComplaints: number;
  /** Inventory at or below its minimum stock level. */
  lowStock: number;
  /** Connections awaiting approval. */
  pendingConnections: number;
  /** Invoices not yet paid, so due and overdue together. */
  dueInvoices: number;
  /** Deletion requests awaiting administrator approval. */
  pendingApprovals: number;
  /** Customers with status 'Active'. */
  activeCustomers: number;
}

export function useBadgeCounts(): BadgeCounts {
  const [counts] = useStorageCollections({
    pendingComplaints: () =>
      StorageService.getComplaints().filter((c) => c.status === 'Pending').length,
    lowStock: () => StorageService.getInventory().filter((i) => i.quantity <= i.minStock).length,
    pendingConnections: () =>
      StorageService.getConnections().filter((c) => c.status === 'Pending').length,
    dueInvoices: () => StorageService.getInvoices().filter((i) => i.status !== 'Paid').length,
    pendingApprovals: () =>
      StorageService.getDeletionRequests().filter((d) => d.status === 'Pending').length,
    activeCustomers: () =>
      StorageService.getCustomers().filter((c) => c.status === 'Active').length,
  });

  return counts;
}
