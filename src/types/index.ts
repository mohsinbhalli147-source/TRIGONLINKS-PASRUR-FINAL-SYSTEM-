export type UserRole = 'Admin' | 'Staff' | 'Guest' | 'Customer';

export type SectionId =
  | 'dashboard'
  | 'customers'
  | 'areas'
  | 'packages'
  | 'connections'
  | 'billing'
  | 'invoices'
  | 'payments'
  | 'due-payments'
  | 'complaints'
  | 'staff'
  | 'staff-performance'
  | 'inventory'
  | 'stock-alerts'
  | 'expenses'
  | 'messages'
  | 'announcements'
  | 'reports'
  | 'company-profile'
  | 'deletion-requests'
  | 'activity-logs';

export type FunctionPermission =
  | 'add_customers'
  | 'edit_customers'
  | 'delete_customers'
  | 'manage_packages'
  | 'approve_connections'
  | 'receive_payments'
  | 'generate_bills'
  | 'delete_records'
  | 'approve_deletions'
  | 'manage_staff'
  | 'view_reports'
  | 'export_data'
  | 'send_messages'
  | 'manage_inventory'
  | 'manage_settings';

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  staffId?: string;
  customerId?: string;
  allowedSections: SectionId[];
  allowedFunctions: FunctionPermission[];
  assignedAreaIds?: string[];
}

export interface CustomerInventoryItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Customer {
  id: string;
  name: string;
  username: string;
  mobile: string;
  alternateMobile?: string;
  email: string;
  cnic: string;
  fatherName?: string;
  address: string;
  landmark?: string;
  areaId: string;
  areaName: string;
  packageId: string;
  packageName: string;
  packageSpeed?: string;
  monthlyFee: number;
  ipCharges?: number;
  ipMonthlyCharges?: number;
  iptvCharges?: number;
  iptvMonthlyCharges?: number;
  hasIptv?: boolean;
  iptvPackageName?: string;
  connectionFee: number;
  totalMonthly: number;
  installDate: string;
  billingDate: number; // 1 to 28
  connectionType: 'Fiber' | 'Wireless' | 'Cable';
  device: string; // ONT, Router, etc.
  deviceModel?: string;
  deviceSerialNumber?: string;
  macAddress?: string;
  opticalPowerDbm?: number; // e.g. -19.4 dBm
  cableLengthMeters?: number;
  splitterPort?: string;
  pppoeUsername?: string;
  pppoePassword?: string;
  password?: string;
  ipAddress: string;
  subnetMask?: string;
  gateway?: string;
  iptvAddress?: string;
  status: 'Active' | 'Suspended';
  walletBalance: number;
  pendingBalance?: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  assignedInventory: CustomerInventoryItem[];
  notes?: string;
  discount?: number;
  discountSetup?: number;
  discountMonthly?: number;
  discountReason?: string;
  discountType?: 'setup' | 'monthly' | 'both';
  createdAt: string;
  updatedAt: string;
}

export interface Package {
  id: string;
  name: string;
  speed: string;
  speedMbps?: number;
  price: number;
  description: string;
  dataLimit?: string;
  contractPeriod?: string;
  installationFee?: number;
  equipmentFee?: number;
  status?: 'Active' | 'Inactive';
  type?: 'Fiber' | 'Wireless' | 'Cable';
  activeSubscribers?: number;
  createdAt?: string;
}

export type PackageItem = Package;

export interface ConnectionRequest {
  id: string;
  customerName?: string;
  applicantName?: string;
  username?: string;
  password?: string;
  fatherName?: string;
  mobile: string;
  alternateMobile?: string;
  email: string;
  cnic?: string;
  address: string;
  landmark?: string;
  areaId: string;
  areaName: string;
  packageId: string;
  packageName: string;
  packageSpeed?: string;
  monthlyFee?: number;
  ipCharges?: number;
  iptvCharges?: number;
  hasIptv?: boolean;
  iptvPackageName?: string;
  connectionFee?: number;
  totalMonthly?: number;
  billingDate?: number;
  connectionType?: 'Fiber' | 'Wireless' | 'Cable';
  device?: string;
  deviceModel?: string;
  deviceSerialNumber?: string;
  macAddress?: string;
  opticalPowerDbm?: number;
  cableLengthMeters?: number;
  splitterPort?: string;
  pppoeUsername?: string;
  pppoePassword?: string;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
  assignedInventory?: CustomerInventoryItem[];
  discount?: number;
  discountSetup?: number;
  discountMonthly?: number;
  discountReason?: string;
  discountType?: 'setup' | 'monthly' | 'both';
  installDate?: string;
  requestDate?: string;
  equipmentDetails?: string;
  assignedStaff?: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  rejectedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceBreakdown {
  packageFee: number;
  ipCharges: number;
  iptvCharges: number;
  inventoryCharges: number;
  lateFee: number;
  discount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  month: string; // e.g. "September 2026"
  year: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Partial';
  breakdown: InvoiceBreakdown;
  createdAt: string;
  username?: string;
  areaName?: string;
  packageName?: string;
  billingMonth?: string;
  paidDate?: string;
  paymentMethod?: string;
  paymentNotes?: string;
  totalAmount?: number;
  issueDate?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  invoiceId?: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'JazzCash' | 'EasyPaisa' | 'Online' | 'Wallet';
  reference: string;
  discount: number;
  discountReason?: string;
  date: string;
  collectedBy: string;
}

export interface StaffMember {
  id: string;
  name: string;
  username?: string;
  email: string;
  password?: string;
  mobile?: string;
  phone?: string;
  role: 'Admin' | 'Technician' | 'Support' | 'Operator' | 'Manager' | 'Accounts' | 'Other';
  salary?: number;
  joinDate?: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  allAreas?: boolean;
  assignedAreaIds?: string[];
  allowedSections: SectionId[];
  allowedFunctions: FunctionPermission[];
  cashInHand?: number;
  totalCollected?: number;
  totalHandedOver?: number;
  createdAt: string;
}

export interface StaffSettlement {
  id: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  amount: number;
  previousBalance: number;
  remainingBalance: number;
  date: string;
  handoverMethod: 'Cash Handover to Admin' | 'Bank Deposit to Admin Account' | 'EasyPaisa' | 'JazzCash' | 'Cheque' | string;
  reference?: string;
  notes?: string;
  settledBy: string;
  receivedBy: string;
  status: 'Completed';
  createdAt: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  unit: string; // Piece, Meter, Box, Pack, Roll, Set, etc.
}

export interface InventoryItem {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  category?: string;
  quantity: number;
  price?: number;
  unitCost?: number;
  sellingPrice?: number;
  supplier?: string;
  status?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  minStock: number;
  unit: string;
  createdAt?: string;
}

export interface RestockRecord {
  id: string;
  itemId: string;
  itemName: string;
  category?: string;
  quantityAdded: number;
  previousQuantity: number;
  newQuantity: number;
  unitCost: number;
  totalCost: number;
  sellingPrice?: number;
  supplier: string;
  supplierContact?: string;
  invoiceNumber?: string;
  date: string;
  paymentMethod?: string;
  paymentStatus?: 'Paid' | 'Credit' | 'Partial';
  recordedBy?: string;
  notes?: string;
  autoExpenseCreated?: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  name?: string;
  category: 'Rent' | 'Utilities' | 'Salaries' | 'Equipment' | 'Maintenance' | 'Marketing' | 'Transport' | 'Other' | 'Upstream Bandwidth' | 'Pole Rental' | 'Fuel & Transport' | 'Hardware Purchases' | 'Office & Electricity' | 'Miscellaneous' | string;
  amount: number;
  date: string;
  areaId?: string;
  areaName?: string;
  description: string;
  paidTo?: string;
  recordedBy?: string;
}

export interface Area {
  id: string;
  name: string;
  code?: string;
  city?: string;
  status?: 'Active' | 'Inactive';
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  customerCount?: number;
  activeComplaints?: number;
}

export interface Complaint {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  areaName?: string;
  subject?: string;
  category?: 'Internet Issue' | 'Billing Issue' | 'Equipment Issue' | 'Service Issue' | 'Other' | string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | 'Critical';
  assignedStaff?: string;
  assignedToId?: string;
  assignedToName?: string;
  status: 'Pending' | 'Working' | 'Solved';
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  subject: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assignedStaff: string;
  status: 'Pending' | 'Working' | 'Solved';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkIssue {
  id: string;
  title: string;
  areaId: string;
  areaName: string;
  severity: 'Critical' | 'Major' | 'Minor';
  affectedCustomersCount: number;
  assignedEngineer: string;
  status: 'Investigating' | 'Identified' | 'Fixing' | 'Resolved';
  details: string;
  reportedAt: string;
  resolvedAt?: string;
}

export interface MessageRecord {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  template: string;
  message: string;
  status: 'Sent' | 'Failed' | 'Draft';
  date: string;
}

export interface Announcement {
  id: string;
  title: string;
  type: 'General' | 'Staff' | 'Customer';
  targetAudience: 'All' | 'Staff Only' | 'Customers Only';
  message: string;
  date: string;
  author: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  action: string;
  section?: string;
  collection?: string;
  details: string;
}

export interface SettingsConfig {
  id: string;
  companyName: string;
  shortName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  licenseNumber: string;
  billingCycle: 'Monthly' | 'Quarterly' | 'Yearly';
  defaultDueDays: number;
  lateFeePercentage: number;
  taxRatePercentage: number;
  notifyBillReminders: boolean;
  notifyPaymentConfirmations: boolean;
  notifyConnectionUpdates: boolean;
  notifyMonthlyReports: boolean;
  adminNotificationEmail?: string;
  autoSaveGoogleContacts?: boolean;
  autoSendGmailAlerts?: boolean;
  lastGoogleSyncTimestamp?: string;
  googleDriveEmail?: string;
  autoBackupToGoogleDrive?: boolean;
  lastGoogleDriveBackupTimestamp?: string;
  googleDriveBackupIntervalHours?: number;
}

export interface DeletionRequest {
  id: string;
  entityType?: 'Customer' | 'Invoice' | 'Staff' | 'Package' | 'Expense' | 'Other' | string;
  targetType?: string;
  entityId?: string;
  targetId?: string;
  entityTitle?: string;
  targetName?: string;
  requestedBy: string;
  requestedByName?: string;
  requestedByEmail?: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt?: string;
  requestedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export const ALL_SECTIONS: { id: SectionId; name: string; group: string; icon: string }[] = [
  // Group 1: Overview
  { id: 'dashboard', name: 'Dashboard', group: 'Overview', icon: 'LayoutDashboard' },
  // Group 2: Customer Management
  { id: 'customers', name: 'Customers', group: 'Customer Management', icon: 'Users' },
  { id: 'areas', name: 'Areas & Sectors', group: 'Customer Management', icon: 'MapPin' },
  { id: 'packages', name: 'Packages & Tariffs', group: 'Customer Management', icon: 'Wifi' },
  { id: 'connections', name: 'Connections', group: 'Customer Management', icon: 'GitPullRequest' },
  // Group 3: Billing & Payments
  { id: 'billing', name: 'Billing Batches', group: 'Billing & Payments', icon: 'Calculator' },
  { id: 'invoices', name: 'Invoices Ledger', group: 'Billing & Payments', icon: 'Receipt' },
  { id: 'payments', name: 'Payments Collection', group: 'Billing & Payments', icon: 'CreditCard' },
  { id: 'due-payments', name: 'Due Payments & Arrears', group: 'Billing & Payments', icon: 'Clock' },
  // Group 4: Support & Operations
  { id: 'complaints', name: 'Complaints & Faults', group: 'Support & Operations', icon: 'AlertCircle' },
  // Group 5: Staff Management
  { id: 'staff', name: 'Staff Management', group: 'Staff Management', icon: 'UserCheck' },
  { id: 'staff-performance', name: 'Staff Performance', group: 'Staff Management', icon: 'TrendingUp' },
  // Group 6: Inventory
  { id: 'inventory', name: 'Inventory Stock', group: 'Inventory', icon: 'Package' },
  { id: 'stock-alerts', name: 'Stock Alerts', group: 'Inventory', icon: 'AlertTriangle' },
  // Group 7: Financials
  { id: 'expenses', name: 'Operational Expenses', group: 'Financials', icon: 'DollarSign' },
  // Group 8: Communication
  { id: 'messages', name: 'SMS & WhatsApp Messages', group: 'Communication', icon: 'MessageSquare' },
  { id: 'announcements', name: 'Broadcast Announcements', group: 'Communication', icon: 'Megaphone' },
  // Group 9: Analytics
  { id: 'reports', name: 'Reports & Analytics', group: 'Analytics', icon: 'BarChart3' },
  // Group 10: System / Admin
  { id: 'company-profile', name: 'Company Profile & ISP', group: 'System / Admin', icon: 'Building2' },
  { id: 'deletion-requests', name: 'Admin Approvals', group: 'System / Admin', icon: 'ShieldCheck' },
  { id: 'activity-logs', name: 'System & Audit Logs', group: 'System / Admin', icon: 'History' },
];

export const ALL_FUNCTIONS: { id: FunctionPermission; name: string; description: string }[] = [
  { id: 'add_customers', name: 'Add Customers', description: 'Create new customer records and onboard subscribers' },
  { id: 'edit_customers', name: 'Edit Customers', description: 'Modify customer plans, hardware, and details' },
  { id: 'delete_customers', name: 'Delete Customers', description: 'Remove customer accounts' },
  { id: 'manage_packages', name: 'Add/Edit/Delete Packages', description: 'Configure internet plans, speeds, and tariffs' },
  { id: 'approve_connections', name: 'Approve Connections', description: 'Approve pending installation requests' },
  { id: 'receive_payments', name: 'Receive Payments', description: 'Collect bill payments and issue receipts' },
  { id: 'generate_bills', name: 'Generate Bills', description: 'Batch generate monthly subscriber invoices' },
  { id: 'delete_records', name: 'Delete Records', description: 'Request or execute deletion of records' },
  { id: 'approve_deletions', name: 'Approve Deletions', description: 'Dual-control approval of sensitive deletions' },
  { id: 'manage_staff', name: 'Manage Staff', description: 'Create staff accounts and configure RBAC permissions' },
  { id: 'view_reports', name: 'View Reports', description: 'Access revenue, growth, and financial reports' },
  { id: 'export_data', name: 'Export Data', description: 'Download CSV and Excel files of records' },
  { id: 'send_messages', name: 'Send Messages', description: 'Send SMS & WhatsApp bill alerts and notices' },
  { id: 'manage_inventory', name: 'Manage Inventory', description: 'Add, edit, and restock equipment' },
  { id: 'manage_settings', name: 'Manage Settings', description: 'Update ISP company profile and billing parameters' },
];

