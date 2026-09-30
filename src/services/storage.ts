import {
  Customer,
  Package,
  ConnectionRequest,
  Invoice,
  Payment,
  StaffMember,
  InventoryCategory,
  InventoryItem,
  RestockRecord,
  StaffSettlement,
  Expense,
  Area,
  Complaint,
  SupportTicket,
  NetworkIssue,
  MessageRecord,
  Announcement,
  ActivityLog,
  SettingsConfig,
  DeletionRequest,
  ALL_SECTIONS,
  ALL_FUNCTIONS,
} from '../types';
import { AppwriteService, redactRecord, type CollectionKey } from './appwrite';
import { pushDocument, removeDocument, pushBulk, isPermanentRejection } from './writeApi';

const STORAGE_KEYS = {
  CUSTOMERS: 'trigon_customers',
  PACKAGES: 'trigon_packages',
  CONNECTIONS: 'trigon_connections',
  INVOICES: 'trigon_invoices',
  PAYMENTS: 'trigon_payments',
  STAFF: 'trigon_staff',
  INVENTORY: 'trigon_inventory',
  CATEGORIES: 'trigon_categories',
  EXPENSES: 'trigon_expenses',
  AREAS: 'trigon_areas',
  COMPLAINTS: 'trigon_complaints',
  TICKETS: 'trigon_tickets',
  NETWORK_ISSUES: 'trigon_network_issues',
  MESSAGES: 'trigon_messages',
  ANNOUNCEMENTS: 'trigon_announcements',
  ACTIVITY: 'trigon_activity',
  SETTINGS: 'trigon_settings',
  DELETION_REQUESTS: 'trigon_deletion_requests',
  RESTOCK_LOGS: 'trigon_restock_logs',
  STAFF_SETTLEMENTS: 'trigon_staff_settlements',
};

// Default seed data
const SEED_AREAS: Area[] = [
  { id: 'area-pasrur', name: 'Pasrur City', code: 'PSR-01', city: 'Pasrur', status: 'Active', customerCount: 15, activeComplaints: 0 },
  { id: 'area-skt', name: 'Sialkot Cantt', code: 'SKT-01', city: 'Sialkot', status: 'Active', customerCount: 8, activeComplaints: 1 },
  { id: 'area-daska', name: 'Daska Central', code: 'DSK-01', city: 'Daska', status: 'Active', customerCount: 6, activeComplaints: 0 },
  { id: 'area-1', name: 'Gulberg III, Lahore', code: 'LHE-GLB3', city: 'Lahore', status: 'Active', customerCount: 12, activeComplaints: 1 },
  { id: 'area-2', name: 'DHA Phase 5, Lahore', code: 'LHE-DHA5', city: 'Lahore', status: 'Active', customerCount: 10, activeComplaints: 0 },
  { id: 'area-3', name: 'Model Town, Lahore', code: 'LHE-MDL', city: 'Lahore', status: 'Active', customerCount: 7, activeComplaints: 0 },
  { id: 'area-4', name: 'Johar Town, Lahore', code: 'LHE-JHR', city: 'Lahore', status: 'Active', customerCount: 9, activeComplaints: 1 },
  { id: 'area-5', name: 'Bahria Town, Lahore', code: 'LHE-BHR', city: 'Lahore', status: 'Active', customerCount: 5, activeComplaints: 0 },
  { id: 'area-6', name: 'Sector F-10, Islamabad', code: 'ISB-F10', city: 'Islamabad', status: 'Active', customerCount: 4, activeComplaints: 0 },
];

const SEED_PACKAGES: Package[] = [
  {
    id: 'pkg-8mbps',
    name: '8 Mbps',
    speed: '8 Mbps',
    speedMbps: 8,
    price: 1800,
    description: '8 Mbps Optical Fiber with HD IPTV Channels included.',
    dataLimit: 'Unlimited',
    contractPeriod: '1 Month',
    installationFee: 2500,
    equipmentFee: 3500,
    status: 'Active',
    type: 'Fiber',
    activeSubscribers: 12,
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'pkg-1',
    name: 'Home Basic Fiber 15 Mbps',
    speed: '15 Mbps',
    speedMbps: 15,
    price: 2200,
    description: 'Affordable unlimited optical fiber for daily browsing, social media, and YouTube.',
    dataLimit: 'Unlimited',
    contractPeriod: '1 Month',
    installationFee: 2500,
    equipmentFee: 3500,
    status: 'Active',
    type: 'Fiber',
    activeSubscribers: 18,
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'pkg-2',
    name: 'Standard Streamer 30 Mbps',
    speed: '30 Mbps',
    speedMbps: 30,
    price: 2800,
    description: 'High-speed symmetrical bandwidth for HD streaming, Zoom calls, and gaming.',
    dataLimit: 'Unlimited',
    contractPeriod: '1 Month',
    installationFee: 2500,
    equipmentFee: 3500,
    status: 'Active',
    type: 'Fiber',
    activeSubscribers: 24,
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'pkg-3',
    name: 'Ultra Pro Fiber 50 Mbps',
    speed: '50 Mbps',
    speedMbps: 50,
    price: 3800,
    description: 'Ultra-low ping connection tailored for online multiplayer gaming, 4K streaming.',
    dataLimit: 'Unlimited',
    contractPeriod: '1 Month',
    installationFee: 2000,
    equipmentFee: 4000,
    status: 'Active',
    type: 'Fiber',
    activeSubscribers: 15,
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'pkg-4',
    name: 'Gigabit Master 100 Mbps',
    speed: '100 Mbps',
    speedMbps: 100,
    price: 5500,
    description: 'Ultra gigabit fiber connection for power users and heavy upload work.',
    dataLimit: 'Unlimited',
    contractPeriod: '1 Month',
    installationFee: 1000,
    equipmentFee: 4500,
    status: 'Active',
    type: 'Fiber',
    activeSubscribers: 8,
    createdAt: '2024-01-10T10:00:00Z',
  },
  {
    id: 'pkg-5',
    name: 'Corporate Dedicated 200 Mbps',
    speed: '200 Mbps',
    price: 9500,
    description: 'Dedicated enterprise leased line with 99.9% SLA, 1 Static IP included.',
    dataLimit: 'Unlimited (1:1 CIR)',
    contractPeriod: '6 Months',
    installationFee: 0,
    equipmentFee: 6000,
    status: 'Active',
    createdAt: '2026-01-10T10:00:00Z',
  },
];

const SEED_CATEGORIES: InventoryCategory[] = [
  { id: 'cat-1', name: 'Optical Network Terminals (ONT)', unit: 'Piece' },
  { id: 'cat-2', name: 'Wi-Fi Dual-Band Routers', unit: 'Piece' },
  { id: 'cat-3', name: 'Fiber Drop Cable (2-Core & 4-Core)', unit: 'Meter' },
  { id: 'cat-4', name: 'Patch Cords (SC/UPC - SC/APC)', unit: 'Piece' },
  { id: 'cat-5', name: 'Fast Field Connectors', unit: 'Pack (100 pcs)' },
  { id: 'cat-6', name: 'SFP Optical Transceivers', unit: 'Piece' },
  { id: 'cat-7', name: 'Joint Enclosures & Splicing Trays', unit: 'Piece' },
];

const SEED_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'Huawei EchoLife HG8546M GPON ONT',
    categoryId: 'cat-1',
    categoryName: 'Optical Network Terminals (ONT)',
    quantity: 24,
    price: 3200,
    supplier: 'Huawei Tech Logistics Lahore',
    status: 'In Stock',
    minStock: 10,
    unit: 'Piece',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'inv-2',
    name: 'TP-Link Archer C6 AC1200 Gigabit Router',
    categoryId: 'cat-2',
    categoryName: 'Wi-Fi Dual-Band Routers',
    quantity: 18,
    price: 4600,
    supplier: 'Dany Technologies Dist.',
    status: 'In Stock',
    minStock: 10,
    unit: 'Piece',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'inv-3',
    name: 'Fiber Drop Cable 2-Core Outdoor (G.657A)',
    categoryId: 'cat-3',
    categoryName: 'Fiber Drop Cable (2-Core & 4-Core)',
    quantity: 450, // Low stock alert for meter-based cable
    price: 32,
    supplier: 'Pakistan Cables & Fiber Hub',
    status: 'Low Stock',
    minStock: 1000,
    unit: 'Meter',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'inv-4',
    name: 'Fiber Patch Cord SC/UPC-SC/APC 5m',
    categoryId: 'cat-4',
    categoryName: 'Patch Cords (SC/UPC - SC/APC)',
    quantity: 7, // Low Stock (< 10)
    price: 280,
    supplier: 'Optics Master Hafeez Centre',
    status: 'Low Stock',
    minStock: 15,
    unit: 'Piece',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'inv-5',
    name: 'Fast Mechanical Connectors SC/UPC (Blue)',
    categoryId: 'cat-5',
    categoryName: 'Fast Field Connectors',
    quantity: 5, // Low Stock (< 10 packs)
    price: 1850,
    supplier: 'Optics Master Hafeez Centre',
    status: 'Low Stock',
    minStock: 8,
    unit: 'Pack (100 pcs)',
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'inv-6',
    name: 'ZTE C320 OLT 10G Uplink Board Module',
    categoryId: 'cat-6',
    categoryName: 'SFP Optical Transceivers',
    quantity: 12,
    price: 14500,
    supplier: 'Telecom Global Supplies',
    status: 'In Stock',
    minStock: 3,
    unit: 'Piece',
    createdAt: '2026-02-01T08:00:00Z',
  },
];

const SEED_STAFF: StaffMember[] = [
  {
    id: 'staff-admin',
    name: 'Mohsin Bhalli (Super Admin)',
    username: 'admin',
    email: 'admin@trigonlinks.pk',
    mobile: '0300-8451122',
    role: 'Admin',
    salary: 150000,
    joinDate: '2025-01-01',
    status: 'Active',
    allAreas: true,
    assignedAreaIds: [],
    allowedSections: ALL_SECTIONS.map((s) => s.id),
    allowedFunctions: ALL_FUNCTIONS.map((f) => f.id),
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'staff-tech',
    name: 'Asim Raza (Senior Field Tech)',
    username: 'tech_asim',
    email: 'tech@trigonlinks.pk',
    mobile: '0321-4992011',
    role: 'Technician',
    salary: 65000,
    joinDate: '2025-04-15',
    status: 'Active',
    allAreas: false,
    assignedAreaIds: ['area-1', 'area-3', 'area-4'],
    allowedSections: [
      'dashboard',
      'customers',
      'connections',
      'complaints',
      'inventory',
      'stock-alerts',
    ],
    allowedFunctions: [
      'add_customers',
      'edit_customers',
      'approve_connections',
      'manage_inventory',
    ],
    createdAt: '2025-04-15T00:00:00Z',
  },
  {
    id: 'staff-support',
    name: 'Fatima Noor (Support Officer)',
    username: 'support_fatima',
    email: 'support@trigonlinks.pk',
    mobile: '0333-7182900',
    role: 'Support',
    salary: 55000,
    joinDate: '2025-08-01',
    status: 'Active',
    allAreas: true,
    assignedAreaIds: [],
    allowedSections: [
      'dashboard',
      'customers',
      'invoices',
      'complaints',
      'messages',
      'announcements',
    ],
    allowedFunctions: [
      'edit_customers',
      'receive_payments',
      'send_messages',
      'view_reports',
    ],
    createdAt: '2025-08-01T00:00:00Z',
  },
];

const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    alternateMobile: '0300-8451122',
    email: 'operator@example.com',
    cnic: '00000-0000000-0',
    fatherName: 'Muhammad Aslam Bhalli',
    address: 'House 45, Street 2, Pasrur',
    landmark: 'Near Shell Pump, Main Katchery Road',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    ipCharges: 0,
    ipMonthlyCharges: 0,
    iptvCharges: 0,
    iptvMonthlyCharges: 0,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei EchoLife HG8546M GPON ONT',
    deviceModel: 'HG8546M Dual-Band',
    deviceSerialNumber: '48575443F882194B',
    macAddress: '4C:1B:86:92:4A:11',
    opticalPowerDbm: -19.4,
    cableLengthMeters: 120,
    splitterPort: 'FAT-04 / Port 7',
    pppoeUsername: 'usman769yy894',
    ipAddress: '192.168.1.10',
    subnetMask: '255.255.255.0',
    gateway: '192.168.1.1',
    iptvAddress: '10.50.4.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    lastPaymentDate: '2024-07-01',
    lastPaymentAmount: 1800,
    assignedInventory: [
      { itemId: 'inv-1', itemName: 'Huawei EchoLife HG8546M GPON ONT', quantity: 1, unitPrice: 3200, totalPrice: 3200 },
      { itemId: 'inv-4', itemName: 'Fiber Patch Cord SC/UPC-SC/APC 5m', quantity: 1, unitPrice: 280, totalPrice: 280 }
    ],
    notes: 'Premium customer in central Pasrur. Stable fiber link with zero packet loss.',
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-2',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    alternateMobile: '0321-4992011',
    email: 'mohsin2@trigonlinks.pk',
    cnic: '00000-0000000-0',
    fatherName: 'Muhammad Aslam Bhalli',
    address: 'House 45, Street 2, Pasrur',
    landmark: 'Adjacent to Masjid Noor, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    ipCharges: 0,
    ipMonthlyCharges: 0,
    iptvCharges: 0,
    iptvMonthlyCharges: 0,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei EchoLife HG8546M GPON ONT',
    deviceModel: 'HG8546M Dual-Band',
    deviceSerialNumber: '48575443F882194C',
    macAddress: '4C:1B:86:92:4A:12',
    opticalPowerDbm: -18.9,
    cableLengthMeters: 95,
    splitterPort: 'FAT-04 / Port 8',
    pppoeUsername: 'usman769yy894_2',
    ipAddress: '192.168.1.10',
    subnetMask: '255.255.255.0',
    gateway: '192.168.1.1',
    iptvAddress: '10.50.4.11',
    status: 'Active',
    walletBalance: 200,
    pendingBalance: 0,
    lastPaymentDate: '2024-07-01',
    lastPaymentAmount: 1800,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-3',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin3@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-4',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin4@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-5',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin5@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-6',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin6@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-7',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin7@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Suspended',
    walletBalance: 0,
    pendingBalance: 3600,
    assignedInventory: [],
    notes: 'Temporarily suspended due to 2 unpaid monthly cycles.',
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-8',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin8@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Suspended',
    walletBalance: 0,
    pendingBalance: 1800,
    assignedInventory: [],
    notes: 'Subscriber requested temporary freeze while traveling.',
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-9',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin9@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-10',
    name: 'Mohsin Bhalli',
    username: 'usman769yy894',
    mobile: '03023456789',
    email: 'mohsin10@trigonlinks.pk',
    cnic: '00000-0000000-0',
    address: 'House 45, Street 2, Pasrur',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-05-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.10',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-11',
    name: 'Chaudhry Waqas',
    username: 'waqas_skt',
    mobile: '0321-7788991',
    alternateMobile: '0333-8899112',
    email: 'waqas.skt@gmail.com',
    cnic: '00000-0000000-0',
    fatherName: 'Chaudhry Munir Ahmad',
    address: 'Street 4, Paris Road, Sialkot Cantt',
    landmark: 'Behind Gourmet Bakers, Paris Road',
    areaId: 'area-skt',
    areaName: 'Sialkot Cantt',
    packageId: 'pkg-2',
    packageName: 'Standard Streamer 30 Mbps',
    packageSpeed: '30 Mbps',
    monthlyFee: 2800,
    ipCharges: 300,
    ipMonthlyCharges: 300,
    iptvCharges: 400,
    iptvMonthlyCharges: 400,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 3500,
    installDate: '2024-04-10',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'TP-Link Archer C6 Gigabit ONT',
    deviceModel: 'Archer C6 AC1200',
    deviceSerialNumber: 'TP7882991024B',
    macAddress: 'E8:48:B8:20:91:02',
    opticalPowerDbm: -17.8,
    cableLengthMeters: 80,
    splitterPort: 'FAT-SKT-02 / Port 3',
    pppoeUsername: 'waqas_skt_fiber',
    ipAddress: '192.168.10.45',
    status: 'Active',
    walletBalance: 1200,
    pendingBalance: 0,
    lastPaymentDate: '2024-07-01',
    lastPaymentAmount: 3500,
    assignedInventory: [],
    createdAt: '2024-04-10T09:00:00Z',
    updatedAt: '2024-07-01T09:00:00Z',
  },
  {
    id: 'cust-12',
    name: 'Rana Zeeshan Ali',
    username: 'zeeshan_daska',
    mobile: '0300-4455667',
    alternateMobile: '0315-9988771',
    email: 'zeeshan.daska@gmail.com',
    cnic: '00000-0000000-0',
    fatherName: 'Rana Liaquat Ali',
    address: 'Near Civil Hospital, Sambrial Road, Daska',
    landmark: 'Opposite State Life Building',
    areaId: 'area-daska',
    areaName: 'Daska Central',
    packageId: 'pkg-1',
    packageName: 'Home Basic Fiber 15 Mbps',
    packageSpeed: '15 Mbps',
    monthlyFee: 2200,
    hasIptv: false,
    connectionFee: 2500,
    totalMonthly: 2200,
    installDate: '2024-03-22',
    billingDate: 5,
    connectionType: 'Fiber',
    device: 'Huawei EchoLife HG8546M GPON ONT',
    deviceSerialNumber: '48575443A992102C',
    macAddress: '3C:8C:F8:71:02:44',
    opticalPowerDbm: -20.1,
    cableLengthMeters: 140,
    splitterPort: 'FAT-DSK-01 / Port 4',
    pppoeUsername: 'zeeshan_daska',
    ipAddress: '192.168.10.88',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 2200,
    assignedInventory: [],
    createdAt: '2024-03-22T08:00:00Z',
    updatedAt: '2024-07-01T08:00:00Z',
  },
  {
    id: 'cust-13',
    name: 'Sheikh Noman (Crown Traders)',
    username: 'crown_noman',
    mobile: '0333-6677889',
    alternateMobile: '0301-2233445',
    email: 'crown.traders@skt.pk',
    cnic: '00000-0000000-0',
    fatherName: 'Sheikh Abdul Hameed',
    address: 'Shop 12-14, Main Circular Road, Pasrur',
    landmark: 'Clock Tower Bazaar',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-3',
    packageName: 'Ultra Pro Fiber 50 Mbps',
    packageSpeed: '50 Mbps',
    monthlyFee: 3800,
    ipCharges: 300,
    ipMonthlyCharges: 300,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2000,
    totalMonthly: 4100,
    installDate: '2024-02-18',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Cisco SFP Optical Bridge + Dual Band ONT',
    deviceSerialNumber: 'CSC788291040A',
    macAddress: '00:25:B3:FF:11:88',
    opticalPowerDbm: -18.2,
    cableLengthMeters: 65,
    splitterPort: 'FAT-01 / Port 1',
    pppoeUsername: 'crown_noman_static',
    ipAddress: '203.135.22.40',
    status: 'Active',
    walletBalance: 4100,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-02-18T10:00:00Z',
    updatedAt: '2024-07-01T10:00:00Z',
  },
  {
    id: 'cust-14',
    name: 'Malik Usman Farooq',
    username: 'usman_pasrur',
    mobile: '0300-8811223',
    email: 'usman.farooq@gmail.com',
    cnic: '00000-0000000-0',
    fatherName: 'Farooq Ahmad Malik',
    address: 'Farooq House, Muhallah Sheikhan, Pasrur',
    landmark: 'Near Govt High School No. 1',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-06-01',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.18',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-06-01T11:00:00Z',
    updatedAt: '2024-07-01T11:00:00Z',
  },
  {
    id: 'cust-15',
    name: 'Syed Ali Raza Shah',
    username: 'ali_raza_shah',
    mobile: '0313-5566778',
    alternateMobile: '0345-1122334',
    email: 'ali.raza@gmail.com',
    cnic: '00000-0000000-0',
    fatherName: 'Syed Manzoor Hussain Shah',
    address: 'Shah House, Railway Road, Pasrur',
    landmark: 'Old Railway Station Chowk',
    areaId: 'area-pasrur',
    areaName: 'Pasrur City',
    packageId: 'pkg-8mbps',
    packageName: '8 Mbps',
    packageSpeed: '8 Mbps',
    monthlyFee: 1800,
    hasIptv: true,
    iptvPackageName: 'Yes (HD)',
    connectionFee: 2500,
    totalMonthly: 1800,
    installDate: '2024-06-15',
    billingDate: 1,
    connectionType: 'Fiber',
    device: 'Huawei GPON ONT',
    ipAddress: '192.168.1.25',
    status: 'Active',
    walletBalance: 0,
    pendingBalance: 0,
    assignedInventory: [],
    createdAt: '2024-06-15T09:00:00Z',
    updatedAt: '2024-07-01T09:00:00Z',
  },
];

const SEED_CONNECTIONS: ConnectionRequest[] = [
  {
    id: 'conn-1',
    customerName: 'Ayesha Malik',
    mobile: '0315-7771234',
    email: 'ayesha.malik@outlook.com',
    address: 'House # 112, Sector C, Bahria Town, Lahore',
    areaId: 'area-5',
    areaName: 'Bahria Town, Lahore',
    packageId: 'pkg-2',
    packageName: 'Standard Streamer 30 Mbps',
    installDate: '2026-09-25',
    equipmentDetails: 'Needs Dual-Band Router + ONT Optical Cable length approx 60m',
    assignedStaff: 'Asim Raza (Senior Field Tech)',
    status: 'Pending',
    createdAt: '2026-09-21T14:30:00Z',
  },
  {
    id: 'conn-2',
    customerName: 'Kashif Mehmood',
    mobile: '0322-8192033',
    email: 'kashif.m@gmail.com',
    address: 'Apartment 5B, Block G, Gulberg III, Lahore',
    areaId: 'area-1',
    areaName: 'Gulberg III, Lahore',
    packageId: 'pkg-3',
    packageName: 'Ultra Pro Fiber 50 Mbps',
    installDate: '2026-09-26',
    equipmentDetails: 'Huawei GPON ONT, Cat6 Patch Cord',
    assignedStaff: 'Asim Raza (Senior Field Tech)',
    status: 'Approved',
    createdAt: '2026-09-22T09:15:00Z',
  },
];

const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-2026-09-01',
    invoiceNumber: 'INV-2026-001',
    customerId: 'cust-101',
    customerName: 'Muhammad Tariq',
    customerMobile: '0300-1234567',
    month: 'September 2026',
    year: 2026,
    amount: 3300,
    paidAmount: 3300,
    remainingAmount: 0,
    dueDate: '2026-09-10',
    status: 'Paid',
    breakdown: {
      packageFee: 2600,
      ipCharges: 300,
      iptvCharges: 400,
      inventoryCharges: 0,
      lateFee: 0,
      discount: 0,
    },
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'inv-2026-09-02',
    invoiceNumber: 'INV-2026-002',
    customerId: 'cust-102',
    customerName: 'Zubair Ahmed Khan',
    customerMobile: '0321-9876543',
    month: 'September 2026',
    year: 2026,
    amount: 6000,
    paidAmount: 0,
    remainingAmount: 6000,
    dueDate: '2026-09-15',
    status: 'Unpaid',
    breakdown: {
      packageFee: 5500,
      ipCharges: 500,
      iptvCharges: 0,
      inventoryCharges: 0,
      lateFee: 0,
      discount: 0,
    },
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'inv-2026-09-03',
    invoiceNumber: 'INV-2026-003',
    customerId: 'cust-103',
    customerName: 'Hamza Farooq',
    customerMobile: '0334-5551234',
    month: 'September 2026',
    year: 2026,
    amount: 1800,
    paidAmount: 1000,
    remainingAmount: 800,
    dueDate: '2026-09-20',
    status: 'Partial',
    breakdown: {
      packageFee: 1800,
      ipCharges: 0,
      iptvCharges: 0,
      inventoryCharges: 0,
      lateFee: 0,
      discount: 0,
    },
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'inv-2026-09-04',
    invoiceNumber: 'INV-2026-004',
    customerId: 'cust-104',
    customerName: 'Dr. Shahbaz Ali',
    customerMobile: '0302-8889911',
    month: 'September 2026',
    year: 2026,
    amount: 4500,
    paidAmount: 0,
    remainingAmount: 4500,
    dueDate: '2026-09-25',
    status: 'Unpaid',
    breakdown: {
      packageFee: 3800,
      ipCharges: 300,
      iptvCharges: 400,
      inventoryCharges: 0,
      lateFee: 0,
      discount: 0,
    },
    createdAt: '2026-09-01T00:00:00Z',
  },
];

const SEED_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    receiptNumber: 'REC-2026-1041',
    invoiceId: 'inv-2026-09-01',
    customerId: 'cust-101',
    customerName: 'Muhammad Tariq',
    amount: 3300,
    method: 'JazzCash',
    reference: 'JC-882947192',
    discount: 0,
    date: '2026-09-05 14:22',
    collectedBy: 'Fatima Noor (Support Officer)',
  },
  {
    id: 'pay-2',
    receiptNumber: 'REC-2026-1042',
    invoiceId: 'inv-2026-09-03',
    customerId: 'cust-103',
    customerName: 'Hamza Farooq',
    amount: 1000,
    method: 'Cash',
    reference: 'CASH-REC-03',
    discount: 0,
    date: '2026-09-12 11:45',
    collectedBy: 'Asim Raza (Senior Field Tech)',
  },
];

const SEED_COMPLAINTS: Complaint[] = [
  {
    id: 'comp-1',
    ticketNumber: 'CMP-2026-091',
    customerId: 'cust-101',
    customerName: 'Muhammad Tariq',
    customerMobile: '0300-1234567',
    category: 'Internet Issue',
    description: 'Frequent optical power fluctuation (-27 dBm). High packet loss in evening hours.',
    priority: 'High',
    assignedStaff: 'Asim Raza (Senior Field Tech)',
    status: 'Working',
    createdAt: '2026-09-22T08:15:00Z',
  },
  {
    id: 'comp-2',
    ticketNumber: 'CMP-2026-092',
    customerId: 'cust-104',
    customerName: 'Dr. Shahbaz Ali',
    customerMobile: '0302-8889911',
    category: 'Billing Issue',
    description: 'Account showing suspended status despite partial payment confirmation via bank transfer.',
    priority: 'Urgent',
    assignedStaff: 'Fatima Noor (Support Officer)',
    status: 'Pending',
    createdAt: '2026-09-23T06:30:00Z',
  },
  {
    id: 'comp-3',
    ticketNumber: 'CMP-2026-089',
    customerId: 'cust-102',
    customerName: 'Zubair Ahmed Khan',
    customerMobile: '0321-9876543',
    category: 'Equipment Issue',
    description: 'Router 5GHz Wi-Fi SSID disappeared after power surge.',
    priority: 'Medium',
    assignedStaff: 'Asim Raza (Senior Field Tech)',
    status: 'Solved',
    createdAt: '2026-09-19T10:00:00Z',
    resolvedAt: '2026-09-19T14:40:00Z',
  },
];

const SEED_TICKETS: SupportTicket[] = [
  {
    id: 'tkt-1',
    ticketNumber: 'TCK-2026-401',
    customerId: 'cust-105',
    customerName: 'Bilal Hassan (Apex Studios)',
    customerMobile: '0312-4447788',
    subject: 'BGP Routing latency to AWS Bahrain region',
    category: 'Network Routing',
    priority: 'Urgent',
    assignedStaff: 'Mohsin Bhalli (Super Admin)',
    status: 'Working',
    notes: 'Escalated to Transworld upstream NOC to verify peering hop at Karachi PIE.',
    createdAt: '2026-09-21T11:00:00Z',
    updatedAt: '2026-09-22T16:00:00Z',
  },
  {
    id: 'tkt-2',
    ticketNumber: 'TCK-2026-402',
    customerId: 'cust-103',
    customerName: 'Hamza Farooq',
    customerMobile: '0334-5551234',
    subject: 'Port forwarding request for home security DVR',
    category: 'Configuration',
    priority: 'Medium',
    assignedStaff: 'Fatima Noor (Support Officer)',
    status: 'Solved',
    notes: 'Configured port 8000 and 554 RTSP on ONT NAT profile.',
    createdAt: '2026-09-18T15:20:00Z',
    updatedAt: '2026-09-18T16:10:00Z',
  },
];

const SEED_NETWORK_ISSUES: NetworkIssue[] = [
  {
    id: 'net-1',
    title: '48-Core Fiber Trunk Cut near Gulberg Main Boulevard Underpass',
    areaId: 'area-1',
    areaName: 'Gulberg III, Lahore',
    severity: 'Critical',
    affectedCustomersCount: 140,
    assignedEngineer: 'Asim Raza (Senior Field Tech)',
    status: 'Fixing',
    details: 'Civil construction road excavation damaged primary fiber conduit. Splicing team is on site with OTDR.',
    reportedAt: '2026-09-23T07:15:00Z',
  },
  {
    id: 'net-2',
    title: 'OLT Sub-rack 2 Fan Tray High Temperature Warning',
    areaId: 'area-2',
    areaName: 'DHA Phase 5, Lahore',
    severity: 'Minor',
    affectedCustomersCount: 0,
    assignedEngineer: 'Asim Raza (Senior Field Tech)',
    status: 'Identified',
    details: 'Air conditioning unit at DHA Phase 5 node room tripped. Backup cooler engaged.',
    reportedAt: '2026-09-22T21:00:00Z',
  },
];

const SEED_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    name: 'PTCL / Transworld 10G IP Transit Bandwidth',
    category: 'Utilities',
    amount: 185000,
    date: '2026-09-05',
    areaName: 'All Areas',
    description: 'Monthly Tier-1 IP Transit upstream bandwidth fee for Trigon Links core POP.',
  },
  {
    id: 'exp-2',
    name: 'Office & Node Room Electricity (LESCO)',
    category: 'Utilities',
    amount: 42000,
    date: '2026-09-10',
    areaName: 'Gulberg III, Lahore',
    description: 'Commercial electricity bill with UPS battery bank charging.',
  },
  {
    id: 'exp-3',
    name: 'Technical Field Team Splicing Tools & Consumables',
    category: 'Equipment',
    amount: 19500,
    date: '2026-09-14',
    areaName: 'All Areas',
    description: 'Purchased 20 boxes of alcohol wipes, fiber cleaver blades, and protective sleeves.',
  },
  {
    id: 'exp-4',
    name: 'Field Van Fuel & Maintenance Allowance',
    category: 'Transport',
    amount: 28000,
    date: '2026-09-18',
    areaName: 'All Areas',
    description: 'Fuel for field vehicles LHE-7821 and LHE-4910.',
  },
];

const SEED_MESSAGES: MessageRecord[] = [
  {
    id: 'msg-1',
    customerId: 'cust-102',
    customerName: 'Zubair Ahmed Khan',
    mobile: '0321-9876543',
    template: 'Billing Reminder',
    message: 'Dear Zubair Ahmed Khan, your Trigon Links bill for September 2026 of Rs. 6000 is due on 2026-09-15. Please pay to avoid service disruption. Thank you for choosing Trigon Links.',
    status: 'Sent',
    date: '2026-09-10 10:00',
  },
  {
    id: 'msg-2',
    customerId: 'cust-101',
    customerName: 'Muhammad Tariq',
    mobile: '0300-1234567',
    template: 'Payment Confirmation',
    message: 'Dear Muhammad Tariq, payment of Rs. 3300 has been received for receipt #REC-2026-1041. Your Trigon Links fiber connection is fully active. Enjoy uninterrupted speed!',
    status: 'Sent',
    date: '2026-09-05 14:23',
  },
];

const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Core OLT Firmware Upgrade Scheduled for Sunday Night',
    type: 'Staff',
    targetAudience: 'Staff Only',
    message: 'All technicians please note that our ZTE C320 core OLT will undergo scheduled security patch update on Sunday 02:00 AM to 04:00 AM. Inquiries should be handled per standard NOC playbook.',
    date: '2026-09-22',
    author: 'Mohsin Bhalli (Super Admin)',
  },
  {
    id: 'ann-2',
    title: 'New High-Speed 100 Mbps & 200 Mbps Fiber Plans Launched',
    type: 'Customer',
    targetAudience: 'All',
    message: 'Trigon Links is proud to announce new gigabit speed tiers across DHA and Gulberg with zero buffering on 4K streaming and dedicated peering with Netflix and Google caches!',
    date: '2026-09-15',
    author: 'Trigon Links Management',
  },
];

const SEED_ACTIVITY: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: '2026-09-23 09:12:00',
    userEmail: 'admin@trigonlinks.pk',
    userName: 'Mohsin Bhalli',
    action: 'System Boot & Verification',
    collection: 'settings',
    details: 'Trigon Links ISP Management System initialized with all 23 modules verified.',
  },
  {
    id: 'act-2',
    timestamp: '2026-09-23 08:30:00',
    userEmail: 'tech@trigonlinks.pk',
    userName: 'Asim Raza',
    action: 'Complaint Updated',
    collection: 'complaints',
    details: 'Ticket CMP-2026-091 marked as Working for customer Muhammad Tariq.',
  },
  {
    id: 'act-3',
    timestamp: '2026-09-22 14:22:00',
    userEmail: 'support@trigonlinks.pk',
    userName: 'Fatima Noor',
    action: 'Connection Approved',
    collection: 'connections',
    details: 'Connection request for Kashif Mehmood approved for onboarding.',
  },
];

const SEED_SETTINGS: SettingsConfig = {
  id: 'config',
  companyName: 'Trigon Links (Pvt.) Ltd.',
  shortName: 'Trigon Links',
  email: 'admin@trigonlinks.pk',
  phone: '+92 42 111-874-466',
  address: 'Plaza 45, Main Boulevard, Gulberg III, Lahore, Pakistan',
  city: 'Lahore',
  licenseNumber: 'PTA-ISP-PLACEHOLDER',
  billingCycle: 'Monthly',
  defaultDueDays: 10,
  lateFeePercentage: 5,
  taxRatePercentage: 19.5,
  notifyBillReminders: true,
  notifyPaymentConfirmations: true,
  notifyConnectionUpdates: true,
  notifyMonthlyReports: true,
  adminNotificationEmail: 'operator@example.com',
  autoSaveGoogleContacts: true,
  autoSendGmailAlerts: true,
  lastGoogleSyncTimestamp: '2026-09-25 12:00:00',
};

const SEED_DELETION_REQUESTS: DeletionRequest[] = [
  {
    id: 'del-req-1',
    entityType: 'Customer',
    entityId: 'cust-old-99',
    entityTitle: 'Farhan Zaidi (Closed Connection)',
    requestedBy: 'Asim Raza (Senior Field Tech)',
    requestedByEmail: 'tech@trigonlinks.pk',
    reason: 'Customer shifted out of Lahore and surrendered ONT hardware.',
    status: 'Pending',
    createdAt: '2026-09-22 17:30',
  },
];

// Direct async sync helpers to Appwrite Cloud
const getDeletedIds = (): Set<string> => {
  const raw = localStorage.getItem('trigon_deleted_ids');
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
};

const registerDeletedId = (id: string) => {
  const set = getDeletedIds();
  if (set.has(id)) return;
  set.add(id);
  try {
    localStorage.setItem('trigon_deleted_ids', JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Could not record deletion tombstone:', e);
  }
};

/**
 * Writes go to the server, which authorizes the caller and then writes to
 * Appwrite with its API key.
 *
 * These used to call Appwrite directly with the signed-in staff member's own
 * session token. That is what made the server's area scoping advisory: Appwrite
 * evaluated the write against the browser, so nothing checked the caller's role
 * or area. Every one of the 39 call sites below keeps its exact signature - only
 * these two bodies changed.
 */
function syncDocToAppwrite(collectionKey: CollectionKey, docId: string, data: unknown) {
  pushDocument(collectionKey, docId, data).catch((err: unknown) => {
    console.warn(`[write] push failed for ${collectionKey}/${docId}:`, err);
    enqueueRetry(collectionKey, docId, data, err);
  });
}

/**
 * Deletes one row from Appwrite, queueing it if the delete does not land.
 *
 * This used to warn and forget. Because the local copy is removed at the same
 * time, a failed delete left the row alive on the server with the API key's
 * permissions but gone from this browser, and nothing ever retried it - so the
 * two copies stayed out of step until someone happened to re-add that id. Creates
 * and updates have queued for a long time; deletes now do too.
 */
function deleteDocFromAppwrite(collectionKey: CollectionKey, docId: string) {
  registerDeletedId(docId);
  removeDocument(collectionKey, docId).catch((err: unknown) => {
    console.warn(`[write] delete failed for ${collectionKey}/${docId}:`, err);
    enqueueRetry(collectionKey, docId, null, err, 'delete');
  });
}

/**
 * The shared body of every per-collection delete.
 *
 * Nine `deleteX` methods were the same four lines with the nouns swapped: read
 * the list, drop the row, persist, delete it in Appwrite, log the activity. The
 * duplication was not harmless - the collection name was written out twice per
 * method, once for the Appwrite delete and again for the audit entry, so a
 * rename could leave a delete logged against the wrong collection.
 *
 * `collection` now feeds both, so they cannot drift. The named `deleteX` methods
 * stay as the public API and each supplies only what actually differs: where the
 * rows live, and the wording of its own audit entry.
 */
function deleteRecord<T extends { id: string }>(input: {
  collection: CollectionKey;
  storageKey: string;
  read: () => T[];
  id: string;
  userEmail: string;
  action: string;
  detail: string;
}): void {
  saveData(input.storageKey, input.read().filter((row) => row.id !== input.id));
  deleteDocFromAppwrite(input.collection, input.id);
  StorageService.logActivity(input.userEmail, 'User', input.action, input.collection, input.detail);
}

/* -------------------------------------------------------------------------- */
/*  Retry queue                                                               */
/*                                                                            */
/*  Writes are local-first, so a failed upload used to be lost forever. Each   */
/*  failure is recorded here and retried by the next sync cycle.                */
/* -------------------------------------------------------------------------- */

interface PendingWrite {
  collection: CollectionKey;
  docId: string;
  /**
   * `upsert` is the default so that queue entries written before deletes were
   * queued keep replaying correctly.
   */
  kind?: 'upsert' | 'delete';
  payload: unknown;
  attempts: number;
}

const PENDING_KEY = 'trigon_pending_writes';
const MAX_PENDING = 500;
const MAX_ATTEMPTS = 5;

function readPending(): PendingWrite[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingWrite[]) : [];
  } catch {
    return [];
  }
}

function writePending(entries: PendingWrite[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(entries.slice(-MAX_PENDING)));
  } catch (e) {
    console.warn('Could not persist the pending-write queue:', e);
  }
}

function enqueueRetry(
  collection: CollectionKey,
  docId: string,
  payload: unknown,
  error?: unknown,
  kind: 'upsert' | 'delete' = 'upsert'
): void {
  /**
   * A rejected change is not a pending change. If the server refused it because
   * of the caller's role or area, it will refuse it identically five more times,
   * and because the queue drains in order it would hold up every legitimate
   * change queued behind it. Dropped with a warning instead.
   */
  if (isPermanentRejection(error)) {
    console.warn(
      `[write] dropping ${collection}/${docId}: the server rejected it permanently.`
    );
    return;
  }

  const entries = readPending().filter(
    (entry) => !(entry.collection === collection && entry.docId === docId)
  );
  entries.push({ collection, docId, kind, payload, attempts: 0 });
  writePending(entries);
}

export async function flushPendingWrites(): Promise<number> {
  const entries = readPending();
  if (entries.length === 0) return 0;

  const remaining: PendingWrite[] = [];
  let flushed = 0;

  for (const entry of entries) {
    if (entry.attempts >= MAX_ATTEMPTS) continue; // give up rather than loop forever
    try {
      // A queued delete replays as a delete, not as an upsert that would
      // resurrect the record.
      if (entry.kind === 'delete') {
        await removeDocument(entry.collection, entry.docId);
      } else {
        await pushDocument(entry.collection, entry.docId, entry.payload);
      }
      flushed += 1;
    } catch (error) {
      if (isPermanentRejection(error)) {
        console.warn(
          `[write] dropped queued ${entry.kind ?? 'upsert'} ${entry.collection}/${entry.docId}: the server rejected it permanently.`
        );
        continue;
      }
      remaining.push({ ...entry, attempts: entry.attempts + 1 });
    }
  }

  writePending(remaining);
  return flushed;
}

// Helper to merge remote list with local list using unique ID deduplication
function mergeDeduplicated<T extends { id: string }>(
  localList: T[],
  remoteList: T[]
): { merged: T[]; changed: boolean } {
  const deletedIds = getDeletedIds();
  const map = new Map<string, T>();

  // Only keep local items that are NOT in tombstone
  for (const item of localList) {
    if (item && item.id && !deletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }

  let changed = false;
  if (remoteList && remoteList.length > 0) {
    for (const remote of remoteList) {
      if (!remote || !remote.id) continue;
      // Do NOT resurrect locally deleted records
      if (deletedIds.has(remote.id)) continue;

      const existing = map.get(remote.id);
      if (!existing) {
        map.set(remote.id, remote);
        changed = true;
        continue;
      }
      // Local edits that have not been uploaded yet must win. A record whose
      // local copy is still queued for push is newer than the server's copy.
      if (isPendingWrite(remote.id)) continue;
      if (!shallowEqual(existing, remote)) {
        map.set(remote.id, remote);
        changed = true;
      }
    }
  }

  return { merged: Array.from(map.values()), changed };
}

function isPendingWrite(docId: string): boolean {
  return readPending().some((entry) => entry.docId === docId);
}

/**
 * Field-by-field comparison. Cheaper than JSON.stringify on every record for
 * every poll, and it still detects nested changes because record values are
 * themselves plain objects.
 */
function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) {
      // Nested objects (e.g. invoice breakdowns) need a deeper check.
      const left = a[key];
      const right = b[key];
      if (
        left &&
        right &&
        typeof left === 'object' &&
        typeof right === 'object' &&
        JSON.stringify(left) !== JSON.stringify(right)
      ) {
        return false;
      }
      if (JSON.stringify(left) !== JSON.stringify(right)) return false;
    }
  }
  return true;
}

/**
 * Credentials are stripped before anything reaches localStorage. The browser
 * cache is a convenience, not a system of record, and it must never hold
 * passwords or PPPoE secrets.
 */
function stripCredentials<T>(records: T[]): T[] {
  if (!Array.isArray(records)) return records;
  return records.map((record) => redactRecord(record));
}

const CREDENTIAL_BEARING_KEYS = new Set(['trigon_staff', 'trigon_customers']);

/** Keeps the audit log bounded so it cannot exhaust storage or the page limit. */
const MAX_ACTIVITY_ENTRIES = 2000;

// Helper to safely load or initialize storage
function loadData<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      // Only populate demo data when the operator has not started using the app.
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    if (raw === '') return seed;

    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return seed;
    // Never replace a corrupt cache with demo records: that silently destroys
    // real data. Surface the problem and let the sync engine repair it.
    if (!Array.isArray(parsed) && Array.isArray(seed)) {
      console.warn(`Storage key "${key}" holds an unexpected shape; ignoring it.`);
      return seed;
    }
    return parsed as T;
  } catch (e) {
    console.error(
      `Storage load error for ${key}. The cached value was left untouched; ` +
        'it will be repaired from the server on the next sync.',
      e
    );
    return seed;
  }
}

function saveData<T>(key: string, data: T): void {
  try {
    const payload = CREDENTIAL_BEARING_KEYS.has(key)
      ? (stripCredentials(data as unknown[]) as unknown as T)
      : data;
    localStorage.setItem(key, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('trigon_db_updated', { detail: { key } }));
  } catch (e) {
    // Surface the failure: a silently dropped write looks like success.
    console.error(`Storage save error for ${key}:`, e);
    window.dispatchEvent(
      new CustomEvent('trigon_storage_error', {
        detail: {
          key,
          message:
            e instanceof DOMException && e.name === 'QuotaExceededError'
              ? 'Local storage is full. Recent changes were not saved on this device.'
              : 'A change could not be saved on this device.',
        },
      })
    );
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Converts the several month formats that have appeared in historic records
 * ("2026-09", "Sep9", "september 2026") into a canonical "September 2026".
 * Returns the current month when the input cannot be understood, instead of
 * silently mislabelling a record.
 */
function normaliseMonthLabel(value: string | undefined): string {
  const fallback = (() => {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  })();

  if (!value || typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  // "September 2026" is already canonical.
  const alreadyCanonical = MONTH_NAMES.find(
    (name) => trimmed.toLowerCase() === name.toLowerCase()
  );
  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (alreadyCanonical && yearMatch) {
    return `${alreadyCanonical} ${yearMatch[1]}`;
  }

  // "2026-09" / "2026-9"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const monthIndex = Number(isoMatch[2]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${MONTH_NAMES[monthIndex]} ${isoMatch[1]}`;
    }
  }

  // "Sep9" / "Sep 2026" / "september"
  for (const month of MONTH_NAMES) {
    if (trimmed.toLowerCase().startsWith(month.slice(0, 3).toLowerCase())) {
      return `${month}${yearMatch ? ` ${yearMatch[1]}` : ''}`.trim();
    }
  }

  const monthIndex = Number(trimmed) - 1;
  if (Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
    return `${MONTH_NAMES[monthIndex]}${yearMatch ? ` ${yearMatch[1]}` : ''}`.trim();
  }

  return fallback;
}

/**
 * The single source of truth for "which collections sync, and where they live
 * locally". Both the periodic pull and the explicit pull use this table, which
 * is how they previously drifted apart and synced different subsets.
 */
const SYNCED_COLLECTIONS: Array<{
  key: CollectionKey;
  storageKey: string;
  read: () => Array<{ id: string }>;
  write: (rows: Array<{ id: string }>) => void;
}> = [];

/** Registers the storage accessors once the service object exists. */
function registerSyncedCollections(): void {
  SYNCED_COLLECTIONS.length = 0;
  const entries: Array<[CollectionKey, string, () => Array<{ id: string }>, (rows: never[]) => void]> = [
    ['customers', STORAGE_KEYS.CUSTOMERS, StorageService.getCustomers, (rows) => saveData(STORAGE_KEYS.CUSTOMERS, rows as unknown as Customer[])],
    ['staff', STORAGE_KEYS.STAFF, StorageService.getStaff, (rows) => saveData(STORAGE_KEYS.STAFF, rows as unknown as StaffMember[])],
    ['invoices', STORAGE_KEYS.INVOICES, StorageService.getInvoices, (rows) => saveData(STORAGE_KEYS.INVOICES, rows as unknown as Invoice[])],
    ['payments', STORAGE_KEYS.PAYMENTS, StorageService.getPayments, (rows) => saveData(STORAGE_KEYS.PAYMENTS, rows as unknown as Payment[])],
    ['complaints', STORAGE_KEYS.COMPLAINTS, StorageService.getComplaints, (rows) => saveData(STORAGE_KEYS.COMPLAINTS, rows as unknown as Complaint[])],
    ['connections', STORAGE_KEYS.CONNECTIONS, StorageService.getConnections, (rows) => saveData(STORAGE_KEYS.CONNECTIONS, rows as unknown as ConnectionRequest[])],
    ['packages', STORAGE_KEYS.PACKAGES, StorageService.getPackages, (rows) => saveData(STORAGE_KEYS.PACKAGES, rows as unknown as Package[])],
    ['areas', STORAGE_KEYS.AREAS, StorageService.getAreas, (rows) => saveData(STORAGE_KEYS.AREAS, rows as unknown as Area[])],
    ['inventory', STORAGE_KEYS.INVENTORY, StorageService.getInventory, (rows) => saveData(STORAGE_KEYS.INVENTORY, rows as unknown as InventoryItem[])],
    ['expenses', STORAGE_KEYS.EXPENSES, StorageService.getExpenses, (rows) => saveData(STORAGE_KEYS.EXPENSES, rows as unknown as Expense[])],
    ['announcements', STORAGE_KEYS.ANNOUNCEMENTS, StorageService.getAnnouncements, (rows) => saveData(STORAGE_KEYS.ANNOUNCEMENTS, rows as unknown as Announcement[])],
  ];

  for (const [key, storageKey, read, write] of entries) {
    SYNCED_COLLECTIONS.push({ key, storageKey, read, write: write as (rows: Array<{ id: string }>) => void });
  }
}

let realtimeCleanup: (() => void) | null = null;

export const StorageService = {
  /**
   * Pull loop that keeps this device's cache in step with the server.
   *
   * This is polling, not a realtime subscription. It returns a teardown
   * function so the interval can actually be cleared: the previous version
   * started an unstoppable 5s timer that survived logout and unmount.
   */
  initRealtimeSync(): () => void {
    if (realtimeCleanup) return realtimeCleanup;

    let running = false;
    let stopped = false;

    const PULL_INTERVAL_MS = 20_000;

    const pullUpdates = async (): Promise<void> => {
      // Skip if a previous round is still in flight, otherwise two rounds
      // interleave their merge-and-write cycles.
      if (running || stopped) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!AppwriteService.getIsConfigured()) return;

      running = true;
      try {
        // Retry anything that failed to upload before pulling new data.
        await flushPendingWrites();

        for (const entry of SYNCED_COLLECTIONS) {
          if (stopped) return;
          try {
            const remote = (await AppwriteService.listDocs(entry.key)) as Array<{ id: string }>;
            if (!remote || remote.length === 0) continue;
            const { merged, changed } = mergeDeduplicated(entry.read(), remote);
            if (changed) entry.write(merged);
          } catch (err) {
            // One failing collection must not abort the rest of the cycle.
            console.warn(`[Sync] ${entry.storageKey} pull failed:`, err);
          }
        }

        if (!stopped) {
          // Maintenance runs on an explicit schedule, not inside a getter.
          StorageService.repairInvoiceLabels();
          StorageService.pruneExpiredConnections();
          StorageService.checkAndAutoGenerateMonthlyBills();
        }
      } catch (err) {
        // Not silent: a broken backend should be visible, just not fatal.
        console.warn('[Sync] pull cycle failed:', err);
      } finally {
        running = false;
      }
    };

    void pullUpdates();

    const timer = window.setInterval(() => void pullUpdates(), PULL_INTERVAL_MS);
    const onFocus = () => void pullUpdates();
    window.addEventListener('focus', onFocus);

    realtimeCleanup = () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      realtimeCleanup = null;
    };
    return realtimeCleanup;
  },

  /** Stops the pull loop. Called on sign-out. */
  stopRealtimeSync(): void {
    realtimeCleanup?.();
  },

  /**
   * Activity logger.
   *
   * The log is the one collection that grows on every single write, so it is
   * capped: without a bound it is the most likely cause of the local storage
   * quota filling up and of reads exceeding the server's 5000-row page limit.
   */
  logActivity(userEmail: string, userName: string, action: string, collection: string, details: string) {
    const logs = StorageService.getActivityLogs();
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      // ISO-8601 so it sorts correctly against the createdAt values on other
      // records; the previous "YYYY-MM-DD HH:mm:ss" string was not sortable.
      timestamp: new Date().toISOString(),
      userEmail,
      userName,
      action,
      collection,
      details,
    };
    saveData(STORAGE_KEYS.ACTIVITY, [newLog, ...logs].slice(0, MAX_ACTIVITY_ENTRIES));
    syncDocToAppwrite('activityLogs', newLog.id, newLog);
  },

  // Customers
  getCustomers(): Customer[] {
    return loadData<Customer[]>(STORAGE_KEYS.CUSTOMERS, SEED_CUSTOMERS);
  },
  saveCustomer(customer: Customer, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getCustomers();
    const idx = list.findIndex((c) => c.id === customer.id);
    let targetCustomer: Customer;
    const isNew = idx < 0;

    if (idx >= 0) {
      targetCustomer = { ...customer, updatedAt: new Date().toISOString() };
      list[idx] = targetCustomer;
      saveData(STORAGE_KEYS.CUSTOMERS, list);
      StorageService.logActivity(userEmail, 'User', 'Customer Updated', 'customers', `Updated customer ${customer.name} (${customer.username})`);
    } else {
      targetCustomer = { ...customer, createdAt: customer.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      list.unshift(targetCustomer);
      saveData(STORAGE_KEYS.CUSTOMERS, list);
      StorageService.logActivity(userEmail, 'User', 'Customer Added', 'customers', `Created customer ${customer.name} (${customer.username})`);
    }
    syncDocToAppwrite('customers', targetCustomer.id, targetCustomer);

    // Auto-sync customer to Google Contacts (Caller ID) and send Gmail notification.
    // Loaded on demand: the Firebase SDK is large and is only needed when a
    // customer is actually saved, not on first paint or during sign-in. Both
    // calls are fire-and-forget either way, so nothing waits on the import.
    const settings = StorageService.getSettings();
    if (settings.autoSaveGoogleContacts !== false) {
      void import('./googleWorkspace')
        .then(({ saveCustomerToGoogleContacts }) => saveCustomerToGoogleContacts(targetCustomer))
        .then((res) => {
          if (res.success) {
            console.log(`[Google Contacts] Successfully saved contact for ${targetCustomer.name} (${targetCustomer.username})`);
          }
        })
        .catch(() => {});
    }

    if (settings.autoSendGmailAlerts !== false) {
      void import('./googleWorkspace')
        .then(({ sendAdminCustomerEmail }) =>
          sendAdminCustomerEmail(
            settings.adminNotificationEmail || 'operator@example.com',
            targetCustomer,
            isNew ? 'New Customer Added' : 'Customer Plan Updated'
          )
        )
        .catch(() => {});
    }
  },
  deleteCustomer(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'customers',
      storageKey: STORAGE_KEYS.CUSTOMERS,
      read: () => StorageService.getCustomers(),
      id,
      userEmail,
      action: 'Customer Deleted',
      detail: `Deleted customer ID ${id}`,
    });
  },
  bulkUpdateCustomerStatus(ids: string[], status: 'Active' | 'Suspended', userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getCustomers();
    // Set lookup instead of Array.includes inside the loop: this runs over the
    // whole customer base on every bulk action.
    const targetIds = new Set(ids);
    const now = new Date().toISOString();
    let updatedCount = 0;

    const updatedList = list.map((c) => {
      if (targetIds.has(c.id)) {
        updatedCount++;
        const upd = { ...c, status, updatedAt: now };
        syncDocToAppwrite('customers', upd.id, upd);
        return upd;
      }
      return c;
    });
    saveData(STORAGE_KEYS.CUSTOMERS, updatedList);
    StorageService.logActivity(userEmail, 'User', 'Bulk Customer Status Update', 'customers', `Updated status to ${status} for ${updatedCount} customers.`);
  },

  // Packages
  getPackages(): Package[] {
    return loadData<Package[]>(STORAGE_KEYS.PACKAGES, SEED_PACKAGES);
  },
  savePackage(pkg: Package, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getPackages();
    const idx = list.findIndex((p) => p.id === pkg.id);
    if (idx >= 0) {
      list[idx] = pkg;
    } else {
      list.push(pkg);
    }
    saveData(STORAGE_KEYS.PACKAGES, list);
    syncDocToAppwrite('packages', pkg.id, pkg);
    StorageService.logActivity(userEmail, 'User', 'Package Saved', 'packages', `Saved package ${pkg.name} (${pkg.speed})`);
  },
  deletePackage(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'packages',
      storageKey: STORAGE_KEYS.PACKAGES,
      read: () => StorageService.getPackages(),
      id,
      userEmail,
      action: 'Package Deleted',
      detail: `Deleted package ID ${id}`,
    });
  },

  // Areas
  getAreas(): Area[] {
    return loadData<Area[]>(STORAGE_KEYS.AREAS, SEED_AREAS);
  },
  saveArea(area: Area, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getAreas();
    const idx = list.findIndex((a) => a.id === area.id);
    if (idx >= 0) {
      list[idx] = area;
    } else {
      list.push(area);
    }
    saveData(STORAGE_KEYS.AREAS, list);
    syncDocToAppwrite('areas', area.id, area);
    StorageService.logActivity(userEmail, 'User', 'Area Saved', 'areas', `Saved service area ${area.name} (${area.code})`);
  },

  // Connections
  /**
   * Pure read. The previous version filtered out expired rejections, wrote to
   * storage and issued remote DELETEs as a side effect of being read, so simply
   * rendering the list destroyed records. That work now happens in
   * pruneExpiredConnections(), which the sync cycle calls explicitly.
   */
  getConnections(): ConnectionRequest[] {
    return loadData<ConnectionRequest[]>(STORAGE_KEYS.CONNECTIONS, SEED_CONNECTIONS);
  },

  /** Removes rejected requests older than 24 hours. Safe to call repeatedly. */
  pruneExpiredConnections(userEmail: string = 'system@trigonlinks.pk'): number {
    const rawList = StorageService.getConnections();
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    const kept: ConnectionRequest[] = [];
    const removed: ConnectionRequest[] = [];

    for (const conn of rawList) {
      const expired =
        conn.status === 'Rejected' &&
        conn.rejectedAt &&
        now - new Date(conn.rejectedAt).getTime() > twentyFourHoursMs;
      if (expired) removed.push(conn);
      else kept.push(conn);
    }

    if (removed.length === 0) return 0;
    saveData(STORAGE_KEYS.CONNECTIONS, kept);
    for (const conn of removed) deleteDocFromAppwrite('connections', conn.id);
    StorageService.logActivity(
      userEmail,
      'System',
      'Expired Connection Requests Purged',
      'connections',
      `Purged ${removed.length} rejected request(s) older than 24 hours.`
    );
    return removed.length;
  },

  saveConnection(conn: ConnectionRequest, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getConnections();
    const idx = list.findIndex((c) => c.id === conn.id);
    if (idx >= 0) {
      list[idx] = conn;
    } else {
      list.unshift(conn);
    }
    saveData(STORAGE_KEYS.CONNECTIONS, list);
    syncDocToAppwrite('connections', conn.id, conn);
    StorageService.logActivity(userEmail, 'User', 'Connection Request Saved', 'connections', `Connection request for ${conn.customerName || conn.applicantName} (${conn.status})`);
  },
  deleteConnection(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'connections',
      storageKey: STORAGE_KEYS.CONNECTIONS,
      read: () => StorageService.getConnections(),
      id,
      userEmail,
      action: 'Connection Deleted',
      detail: `Deleted connection ID ${id}`,
    });
  },

  // Invoices
  /**
   * Pure read. De-duplication and month-label repair used to happen here, which
   * meant a render could rewrite storage and delete server records. The repair
   * now lives in repairInvoiceLabels(), called from the sync cycle.
   */
  getInvoices(): Invoice[] {
    return loadData<Invoice[]>(STORAGE_KEYS.INVOICES, SEED_INVOICES);
  },

  /**
   * Normalises legacy month labels and drops duplicate invoices.
   *
   * The old check was a substring test against the literal "September 2026",
   * which also matched "September 20260" and mislabelled every other month.
   */
  repairInvoiceLabels(userEmail: string = 'system@trigonlinks.pk'): number {
    const raw = loadData<Invoice[]>(STORAGE_KEYS.INVOICES, SEED_INVOICES);
    const seen = new Set<string>();
    const kept: Invoice[] = [];
    const removed: Invoice[] = [];
    let repaired = 0;

    for (const inv of raw || []) {
      if (!inv || !inv.customerId) continue;

      const month = normaliseMonthLabel(inv.month);
      if (month && inv.month !== month) {
        inv.month = month;
        repaired += 1;
      }

      const key = `${inv.customerId}-${month}`;
      if (seen.has(key)) {
        removed.push(inv);
        continue;
      }
      seen.add(key);
      kept.push(inv);
    }

    if (repaired === 0 && removed.length === 0) return 0;

    saveData(STORAGE_KEYS.INVOICES, kept);
    for (const inv of removed) deleteDocFromAppwrite('invoices', inv.id);
    for (const inv of kept) {
      if (inv.month && normaliseMonthLabel(inv.month) === inv.month) {
        syncDocToAppwrite('invoices', inv.id, inv);
      }
    }
    StorageService.logActivity(
      userEmail,
      'System',
      'Invoice Data Repaired',
      'invoices',
      `Normalised ${repaired} month label(s) and removed ${removed.length} duplicate invoice(s).`
    );
    return repaired + removed.length;
  },

  saveInvoice(invoice: Invoice, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getInvoices();
    const idx = list.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) {
      list[idx] = invoice;
    } else {
      list.unshift(invoice);
    }
    saveData(STORAGE_KEYS.INVOICES, list);
    syncDocToAppwrite('invoices', invoice.id, invoice);
    StorageService.logActivity(userEmail, 'User', 'Invoice Saved', 'invoices', `Invoice ${invoice.invoiceNumber} for ${invoice.customerName} (Rs. ${invoice.amount})`);
  },
  generateAllBills(month: string, userEmail: string = 'admin@trigonlinks.pk'): number {
    const customers = StorageService.getCustomers().filter((c) => c.status === 'Active');
    const existingInvoices = StorageService.getInvoices();
    let generatedCount = 0;

    customers.forEach((cust) => {
      // Check if bill already exists for this customer and month
      const exists = existingInvoices.some((inv) => inv.customerId === cust.id && inv.month === month);
      if (!exists) {
        const invNumber = `INV-${new Date().getFullYear()}-${String(existingInvoices.length + generatedCount + 1).padStart(4, '0')}`;
        const newInvoice: Invoice = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          invoiceNumber: invNumber,
          customerId: cust.id,
          customerName: cust.name,
          customerMobile: cust.mobile,
          month,
          year: new Date().getFullYear(),
          amount: cust.totalMonthly,
          paidAmount: 0,
          remainingAmount: cust.totalMonthly,
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
          status: 'Unpaid',
          breakdown: {
            packageFee: cust.monthlyFee,
            ipCharges: cust.ipCharges || 0,
            iptvCharges: cust.iptvCharges || 0,
            inventoryCharges: 0,
            lateFee: 0,
            discount: 0,
          },
          createdAt: new Date().toISOString(),
        };
        existingInvoices.unshift(newInvoice);
        syncDocToAppwrite('invoices', newInvoice.id, newInvoice);
        generatedCount++;
      }
    });

    saveData(STORAGE_KEYS.INVOICES, existingInvoices);
    StorageService.logActivity(userEmail, 'User', 'Batch Bill Generation', 'invoices', `Generated ${generatedCount} invoices for ${month}`);
    return generatedCount;
  },

  generateBatchInvoices(
    month: string,
    dueDate: string,
    userEmail: string = 'admin@trigonlinks.pk'
  ): Invoice[] {
    const customers = StorageService.getCustomers().filter((c) => c.status === 'Active');
    const existingInvoices = StorageService.getInvoices();
    const newInvoices: Invoice[] = [];

    customers.forEach((cust) => {
      const exists = existingInvoices.some((inv) => inv.customerId === cust.id && inv.month === month);
      if (!exists) {
        const invNumber = `INV-${new Date().getFullYear()}-${String(existingInvoices.length + newInvoices.length + 1).padStart(4, '0')}`;
        const newInvoice: Invoice = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          invoiceNumber: invNumber,
          customerId: cust.id,
          customerName: cust.name,
          customerMobile: cust.mobile,
          month,
          year: new Date().getFullYear(),
          amount: cust.totalMonthly,
          paidAmount: 0,
          remainingAmount: cust.totalMonthly,
          dueDate: dueDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
          status: 'Unpaid',
          breakdown: {
            packageFee: cust.monthlyFee,
            ipCharges: cust.ipCharges || cust.ipMonthlyCharges || 0,
            iptvCharges: cust.iptvCharges || cust.iptvMonthlyCharges || 0,
            inventoryCharges: 0,
            lateFee: 0,
            discount: 0,
          },
          createdAt: new Date().toISOString(),
        };
        newInvoices.push(newInvoice);
        syncDocToAppwrite('invoices', newInvoice.id, newInvoice);
      }
    });

    const updated = [...newInvoices, ...existingInvoices];
    saveData(STORAGE_KEYS.INVOICES, updated);
    StorageService.logActivity(
      userEmail,
      'User',
      'Batch Bill Generation',
      'invoices',
      `Generated ${newInvoices.length} invoices for ${month} with due date ${dueDate}`
    );
    return newInvoices;
  },

  checkAndAutoGenerateMonthlyBills(userEmail: string = 'system@trigonlinks.pk'): number {
    const customers = StorageService.getCustomers().filter((c) => c.status === 'Active');
    const existingInvoices = StorageService.getInvoices();
    const now = new Date();
    const currentDay = now.getDate();
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`; // e.g. "September 2026"
    const currentMonthShort = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // e.g. "2026-09"
    let count = 0;

    customers.forEach((cust) => {
      const billingDay = cust.billingDate || 1;

      // When today's day matches or passed the customer's billing day
      if (currentDay >= billingDay) {
        // STRICT DUPLICATE PREVENTION: Never generate twice for same customer & month
        const alreadyBilled = existingInvoices.some(
          (inv) =>
            inv.customerId === cust.id &&
            (inv.month === currentMonthLabel ||
              inv.month === currentMonthShort ||
              (inv.month && inv.month.toLowerCase().includes(currentMonthLabel.toLowerCase())) ||
              (inv.month && inv.month.toLowerCase().includes(currentMonthShort.toLowerCase())) ||
              (inv.createdAt && inv.createdAt.startsWith(currentMonthShort)))
        );

        if (!alreadyBilled) {
          const invNumber = `INV-${now.getFullYear()}-${String(existingInvoices.length + count + 1).padStart(4, '0')}`;
          const dueDay = Math.min(28, billingDay + 10);
          const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

          const shortCustId = cust.id.replace('cust-', '');
          const newInvoice: Invoice = {
            id: `ia-${shortCustId}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`, // max 25 chars, 100% within 36 limit
            invoiceNumber: invNumber,
            customerId: cust.id,
            customerName: cust.name,
            customerMobile: cust.mobile,
            month: currentMonthLabel,
            year: now.getFullYear(),
            amount: cust.totalMonthly || cust.monthlyFee || 2000,
            paidAmount: 0,
            remainingAmount: cust.totalMonthly || cust.monthlyFee || 2000,
            dueDate,
            status: 'Unpaid',
            breakdown: {
              packageFee: cust.monthlyFee || 2000,
              ipCharges: cust.ipCharges || 0,
              iptvCharges: cust.iptvCharges || 0,
              inventoryCharges: 0,
              lateFee: 0,
              discount: 0,
            },
            createdAt: now.toISOString(),
          };

          existingInvoices.unshift(newInvoice);
          syncDocToAppwrite('invoices', newInvoice.id, newInvoice);
          count++;
        }
      }
    });

    if (count > 0) {
      saveData(STORAGE_KEYS.INVOICES, existingInvoices);
      StorageService.logActivity(
        userEmail,
        'Auto Billing Engine',
        'Auto Invoices Generated',
        'invoices',
        `Auto-generated ${count} monthly invoices for ${currentMonthLabel} based on customer billing cycle.`
      );
    }

    return count;
  },

  // Payments
  getPayments(): Payment[] {
    return loadData<Payment[]>(STORAGE_KEYS.PAYMENTS, SEED_PAYMENTS);
  },
  recordPayment(payment: Payment, userEmail: string = 'admin@trigonlinks.pk'): void {
    const payments = StorageService.getPayments();
    payments.unshift(payment);
    saveData(STORAGE_KEYS.PAYMENTS, payments);
    syncDocToAppwrite('payments', payment.id, payment);

    // If attached to invoice, update invoice
    if (payment.invoiceId) {
      const invoices = StorageService.getInvoices();
      const inv = invoices.find((i) => i.id === payment.invoiceId);
      if (inv) {
        inv.paidAmount = (inv.paidAmount || 0) + payment.amount + (payment.discount || 0);
        inv.remainingAmount = Math.max(0, inv.amount - inv.paidAmount);
        inv.status = inv.remainingAmount <= 0 ? 'Paid' : 'Partial';
        saveData(STORAGE_KEYS.INVOICES, invoices);
        syncDocToAppwrite('invoices', inv.id, inv);
      }
    }

    // If paid via wallet, deduct from customer wallet
    if (payment.method === 'Wallet') {
      const customers = StorageService.getCustomers();
      const cust = customers.find((c) => c.id === payment.customerId);
      if (cust) {
        cust.walletBalance = Math.max(0, (cust.walletBalance || 0) - payment.amount);
        saveData(STORAGE_KEYS.CUSTOMERS, customers);
        syncDocToAppwrite('customers', cust.id, cust);
      }
    }

    StorageService.logActivity(
      userEmail,
      'User',
      'Payment Received',
      'payments',
      `Received Rs. ${payment.amount} via ${payment.method} from ${payment.customerName} (Receipt: ${payment.receiptNumber})`
    );
  },

  // Staff
  getStaff(): StaffMember[] {
    return loadData<StaffMember[]>(STORAGE_KEYS.STAFF, SEED_STAFF);
  },
  saveStaff(staff: StaffMember, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getStaff();
    const idx = list.findIndex((s) => s.id === staff.id);
    if (idx >= 0) {
      list[idx] = staff;
    } else {
      list.push(staff);
    }
    saveData(STORAGE_KEYS.STAFF, list);
    syncDocToAppwrite('staff', staff.id, staff);
    StorageService.logActivity(userEmail, 'User', 'Staff Profile Saved', 'staff', `Updated staff member ${staff.name} (${staff.role})`);
  },
  deleteStaff(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'staff',
      storageKey: STORAGE_KEYS.STAFF,
      read: () => StorageService.getStaff(),
      id,
      userEmail,
      action: 'Staff Deleted',
      detail: `Deleted staff ID ${id}`,
    });
  },

  // Inventory
  getCategories(): InventoryCategory[] {
    return loadData<InventoryCategory[]>(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
  },
  /**
   * Saves an inventory category.
   *
   * This was the only mutator with no audit entry at all, so a change to the
   * stock taxonomy left no trace of who made it.
   */
  saveCategory(cat: InventoryCategory, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getCategories();
    const idx = list.findIndex((c) => c.id === cat.id);
    if (idx >= 0) {
      list[idx] = cat;
    } else {
      list.push(cat);
    }
    saveData(STORAGE_KEYS.CATEGORIES, list);
    StorageService.logActivity(
      userEmail,
      'User',
      'Inventory Category Saved',
      'inventory',
      `Saved inventory category ${cat.name ?? cat.id}`
    );
  },
  getInventory(): InventoryItem[] {
    return loadData<InventoryItem[]>(STORAGE_KEYS.INVENTORY, SEED_INVENTORY);
  },
  saveInventoryItem(item: InventoryItem, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getInventory();
    const resolvedPrice = item.sellingPrice || item.price || item.unitCost || 0;
    const itemToSave: InventoryItem = {
      ...item,
      price: resolvedPrice,
      sellingPrice: item.sellingPrice || resolvedPrice,
      unitCost: item.unitCost || (resolvedPrice > 0 ? resolvedPrice : 0),
    };
    const idx = list.findIndex((i) => i.id === itemToSave.id);
    if (idx >= 0) {
      list[idx] = itemToSave;
    } else {
      list.push(itemToSave);
    }
    saveData(STORAGE_KEYS.INVENTORY, list);
    syncDocToAppwrite('inventory', itemToSave.id, itemToSave);
    StorageService.logActivity(userEmail, 'User', 'Inventory Item Saved', 'inventory', `Updated inventory ${itemToSave.name} (Qty: ${itemToSave.quantity}, Price: Rs. ${resolvedPrice})`);
  },
  restockItem(id: string, additionalQty: number, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getInventory();
    const item = list.find((i) => i.id === id);
    if (item) {
      item.quantity += additionalQty;
      item.status = item.quantity <= item.minStock ? 'Low Stock' : 'In Stock';
      saveData(STORAGE_KEYS.INVENTORY, list);
      syncDocToAppwrite('inventory', item.id, item);
      StorageService.logActivity(
        userEmail,
        'User',
        'Stock Restocked',
        'inventory',
        `Added +${additionalQty} to ${item.name}. New total: ${item.quantity}`
      );
    }
  },
  deleteInventoryItem(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'inventory',
      storageKey: STORAGE_KEYS.INVENTORY,
      read: () => StorageService.getInventory(),
      id,
      userEmail,
      action: 'Inventory Item Deleted',
      detail: `Deleted item ID ${id}`,
    });
  },

  // Restock Logs & Purchase Batches
  getRestockLogs(): RestockRecord[] {
    return loadData<RestockRecord[]>(STORAGE_KEYS.RESTOCK_LOGS, []);
  },
  recordRestock(restock: RestockRecord, userEmail: string = 'admin@trigonlinks.pk'): void {
    const logs = StorageService.getRestockLogs();
    logs.unshift(restock);
    saveData(STORAGE_KEYS.RESTOCK_LOGS, logs);

    // Update or create inventory item
    const inventory = StorageService.getInventory();
    const item = inventory.find((i) => i.id === restock.itemId);

    if (item) {
      item.quantity += restock.quantityAdded;
      if (restock.unitCost > 0) item.unitCost = restock.unitCost;
      if (restock.sellingPrice && restock.sellingPrice > 0) item.sellingPrice = restock.sellingPrice;
      if (restock.supplier) item.supplier = restock.supplier;
      item.status = item.quantity <= item.minStock ? 'Low Stock' : 'In Stock';
      StorageService.saveInventoryItem(item, userEmail);
    } else {
      // New item created on the fly
      const newItem: InventoryItem = {
        id: restock.itemId,
        name: restock.itemName,
        category: restock.category || 'Hardware',
        quantity: restock.quantityAdded,
        unitCost: restock.unitCost,
        sellingPrice: restock.sellingPrice || Math.round(restock.unitCost * 1.3),
        minStock: 5,
        unit: restock.category === 'Cable' ? 'meters' : 'pcs',
        supplier: restock.supplier,
        status: restock.quantityAdded <= 5 ? 'Low Stock' : 'In Stock',
        createdAt: restock.date || new Date().toISOString().split('T')[0],
      };
      StorageService.saveInventoryItem(newItem, userEmail);
    }

    // Auto Expense Posting
    if (restock.autoExpenseCreated && restock.totalCost > 0) {
      const exp: Expense = {
        id: `exp-restock-${Date.now()}`,
        name: `Restock: ${restock.itemName}`,
        category: 'Hardware Purchases',
        amount: restock.totalCost,
        date: restock.date || new Date().toISOString().split('T')[0],
        description: `Restocked ${restock.quantityAdded} units of ${restock.itemName} @ Rs. ${restock.unitCost.toLocaleString()} from ${restock.supplier || 'Vendor'} (Invoice: ${restock.invoiceNumber || 'N/A'})`,
        paidTo: restock.supplier || 'Vendor',
        recordedBy: userEmail,
      };
      StorageService.saveExpense(exp, userEmail);
    }

    StorageService.logActivity(
      userEmail,
      'User',
      'Stock Restocked',
      'inventory',
      `Restocked +${restock.quantityAdded} of ${restock.itemName} @ Rs. ${restock.unitCost} (Total: Rs. ${restock.totalCost.toLocaleString()}, Supplier: ${restock.supplier})`
    );
  },

  // Staff Cash Recovery & Settlements (Cashbook Ledger)
  getStaffSettlements(): StaffSettlement[] {
    return loadData<StaffSettlement[]>(STORAGE_KEYS.STAFF_SETTLEMENTS, []);
  },
  recordStaffSettlement(settlement: StaffSettlement, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getStaffSettlements();
    list.unshift(settlement);
    saveData(STORAGE_KEYS.STAFF_SETTLEMENTS, list);

    // Update staff cash in hand cache if present
    const staffList = StorageService.getStaff();
    const st = staffList.find(
      (s) => s.id === settlement.staffId || s.email.toLowerCase() === settlement.staffEmail.toLowerCase()
    );
    if (st) {
      st.cashInHand = settlement.remainingBalance;
      st.totalHandedOver = (st.totalHandedOver || 0) + settlement.amount;
      saveData(STORAGE_KEYS.STAFF, staffList);
      syncDocToAppwrite('staff', st.id, st);
    }

    StorageService.logActivity(
      userEmail,
      'User',
      'Staff Cash Handover',
      'staff',
      `Handed over Rs. ${settlement.amount.toLocaleString()} from ${settlement.staffName} to Admin (${settlement.handoverMethod})`
    );
  },
  getStaffCashBalance(staff: StaffMember): { totalCollected: number; totalSettled: number; inHandBalance: number } {
    const payments = StorageService.getPayments();
    const settlements = StorageService.getStaffSettlements();

    const staffName = staff.name.trim().toLowerCase();
    const staffEmail = staff.email.trim().toLowerCase();
    const staffUser = (staff.username || '').trim().toLowerCase();

    // A payment is attributed to a person only on an exact identifier match.
    // The previous `collectedBy.includes(staffName)` meant "Asim" also matched
    // "Asima" and any free-text note containing the name, so cash was credited
    // to the wrong person.
    const belongsToStaff = (value: string | undefined): boolean => {
      if (!value) return false;
      const candidate = value.trim().toLowerCase();
      if (candidate === staff.id || candidate === staffEmail) return true;
      if (staffUser && candidate === staffUser) return true;
      if (candidate === staffName) return true;
      // Allow the "Name (username)" form some records use.
      const withoutSuffix = candidate.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (withoutSuffix === staffName) return true;
      return Boolean(staffUser) && withoutSuffix === staffUser;
    };

    const staffPayments = payments.filter((p) => belongsToStaff(p.collectedBy));

    const totalCollected = staffPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const staffSettlements = settlements.filter((s) => {
      return (
        s.staffId === staff.id ||
        s.staffEmail.trim().toLowerCase() === staffEmail ||
        s.staffName.trim().toLowerCase() === staffName
      );
    });

    const totalSettled = staffSettlements.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const inHandBalance = Math.max(0, totalCollected - totalSettled);

    return { totalCollected, totalSettled, inHandBalance };
  },

  // Expenses
  getExpenses(): Expense[] {
    return loadData<Expense[]>(STORAGE_KEYS.EXPENSES, SEED_EXPENSES);
  },
  saveExpense(expense: Expense, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getExpenses();
    const idx = list.findIndex((e) => e.id === expense.id);
    if (idx >= 0) {
      list[idx] = expense;
    } else {
      list.unshift(expense);
    }
    saveData(STORAGE_KEYS.EXPENSES, list);
    syncDocToAppwrite('expenses', expense.id, expense);
    StorageService.logActivity(userEmail, 'User', 'Expense Recorded', 'expenses', `Recorded Rs. ${expense.amount} for ${expense.name} (${expense.category})`);
  },
  deleteExpense(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'expenses',
      storageKey: STORAGE_KEYS.EXPENSES,
      read: () => StorageService.getExpenses(),
      id,
      userEmail,
      action: 'Expense Deleted',
      detail: `Deleted expense ID ${id}`,
    });
  },

  // Complaints
  getComplaints(): Complaint[] {
    return loadData<Complaint[]>(STORAGE_KEYS.COMPLAINTS, SEED_COMPLAINTS);
  },
  saveComplaint(complaint: Complaint, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getComplaints();
    const idx = list.findIndex((c) => c.id === complaint.id);
    if (idx >= 0) {
      list[idx] = complaint;
    } else {
      list.unshift(complaint);
    }
    saveData(STORAGE_KEYS.COMPLAINTS, list);
    syncDocToAppwrite('complaints', complaint.id, complaint);
    StorageService.logActivity(userEmail, 'User', 'Complaint Saved', 'complaints', `Complaint ${complaint.ticketNumber} for ${complaint.customerName} status: ${complaint.status}`);
  },
  deleteComplaint(id: string, userEmail: string = 'admin@trigonlinks.pk'): void {
    deleteRecord({
      collection: 'complaints',
      storageKey: STORAGE_KEYS.COMPLAINTS,
      read: () => StorageService.getComplaints(),
      id,
      userEmail,
      action: 'Complaint Deleted',
      detail: `Deleted complaint ID ${id}`,
    });
  },

  // Tickets
  getTickets(): SupportTicket[] {
    return loadData<SupportTicket[]>(STORAGE_KEYS.TICKETS, SEED_TICKETS);
  },
  saveTicket(ticket: SupportTicket, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getTickets();
    const idx = list.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      list[idx] = ticket;
    } else {
      list.unshift(ticket);
    }
    saveData(STORAGE_KEYS.TICKETS, list);
    StorageService.logActivity(userEmail, 'User', 'Ticket Saved', 'support-tickets', `Ticket ${ticket.ticketNumber} updated`);
  },

  // Network Issues
  getNetworkIssues(): NetworkIssue[] {
    return loadData<NetworkIssue[]>(STORAGE_KEYS.NETWORK_ISSUES, SEED_NETWORK_ISSUES);
  },
  saveNetworkIssue(issue: NetworkIssue, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getNetworkIssues();
    const idx = list.findIndex((n) => n.id === issue.id);
    if (idx >= 0) {
      list[idx] = issue;
    } else {
      list.unshift(issue);
    }
    saveData(STORAGE_KEYS.NETWORK_ISSUES, list);
    StorageService.logActivity(userEmail, 'User', 'Network Incident Logged', 'network-issues', `${issue.title} (Status: ${issue.status})`);
  },

  // Messages
  getMessages(): MessageRecord[] {
    return loadData<MessageRecord[]>(STORAGE_KEYS.MESSAGES, SEED_MESSAGES);
  },
  sendMessage(message: MessageRecord, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getMessages();
    list.unshift(message);
    saveData(STORAGE_KEYS.MESSAGES, list);
    syncDocToAppwrite('messages', message.id, message);
    StorageService.logActivity(userEmail, 'User', 'Message Sent', 'messages', `Message sent to ${message.customerName} (${message.mobile})`);
  },

  // Announcements
  getAnnouncements(): Announcement[] {
    return loadData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, SEED_ANNOUNCEMENTS);
  },
  saveAnnouncement(ann: Announcement, userEmail: string = 'admin@trigonlinks.pk'): void {
    const list = StorageService.getAnnouncements();
    const idx = list.findIndex((a) => a.id === ann.id);
    if (idx >= 0) {
      list[idx] = ann;
    } else {
      list.unshift(ann);
    }
    saveData(STORAGE_KEYS.ANNOUNCEMENTS, list);
    syncDocToAppwrite('announcements', ann.id, ann);
    StorageService.logActivity(userEmail, 'User', 'Announcement Published', 'announcements', `Published ${ann.title}`);
  },

  // Activity Logs
  getActivityLogs(): ActivityLog[] {
    return loadData<ActivityLog[]>(STORAGE_KEYS.ACTIVITY, SEED_ACTIVITY);
  },

  // Settings
  getSettings(): SettingsConfig {
    return loadData<SettingsConfig>(STORAGE_KEYS.SETTINGS, SEED_SETTINGS);
  },
  saveSettings(settings: SettingsConfig, userEmail: string = 'admin@trigonlinks.pk'): void {
    saveData(STORAGE_KEYS.SETTINGS, settings);
    syncDocToAppwrite('settings', 'settings', settings);
    StorageService.logActivity(userEmail, 'User', 'Settings Updated', 'settings', 'Updated ISP company settings and billing configurations');
  },

  // Deletion Requests (Admin Approvals queue)
  getDeletionRequests(): DeletionRequest[] {
    return loadData<DeletionRequest[]>(STORAGE_KEYS.DELETION_REQUESTS, SEED_DELETION_REQUESTS);
  },
  submitDeletionRequest(request: DeletionRequest, userEmail: string): void {
    const list = StorageService.getDeletionRequests();
    list.unshift(request);
    saveData(STORAGE_KEYS.DELETION_REQUESTS, list);
    syncDocToAppwrite('deletionRequests', request.id, request);
    StorageService.logActivity(userEmail, 'User', 'Deletion Requested', 'deletion-requests', `Submitted deletion request for ${request.entityType}: ${request.entityTitle}`);
  },
  approveDeletion(id: string, reviewerEmail: string): void {
    const list = StorageService.getDeletionRequests();
    const req = list.find((r) => r.id === id);
    if (req) {
      req.status = 'Approved';
      req.reviewedBy = reviewerEmail;
      req.reviewedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      saveData(STORAGE_KEYS.DELETION_REQUESTS, list);

      // Perform actual deletion based on entityType
      const targetId = req.entityId || req.targetId || '';
      const entityType = (req.entityType || req.targetType || '').toLowerCase();
      if (targetId) {
        registerDeletedId(targetId);
        if (entityType.includes('customer')) {
          StorageService.deleteCustomer(targetId, reviewerEmail);
        } else if (entityType.includes('staff')) {
          StorageService.deleteStaff(targetId, reviewerEmail);
        } else if (entityType.includes('package')) {
          StorageService.deletePackage(targetId, reviewerEmail);
        } else if (entityType.includes('expense')) {
          StorageService.deleteExpense(targetId, reviewerEmail);
        } else if (entityType.includes('connection')) {
          StorageService.deleteConnection(targetId, reviewerEmail);
        } else if (entityType.includes('complaint')) {
          StorageService.deleteComplaint(targetId, reviewerEmail);
        } else if (entityType.includes('inventory')) {
          StorageService.deleteInventoryItem(targetId, reviewerEmail);
        }
      }

      StorageService.logActivity(reviewerEmail, 'Admin', 'Deletion Approved', 'deletion-requests', `Approved deletion for ${req.entityType || req.targetType}: ${req.entityTitle || req.targetName}`);
    }
  },
  rejectDeletion(id: string, reviewerEmail: string): void {
    const list = StorageService.getDeletionRequests();
    const req = list.find((r) => r.id === id);
    if (req) {
      req.status = 'Rejected';
      req.reviewedBy = reviewerEmail;
      req.reviewedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      saveData(STORAGE_KEYS.DELETION_REQUESTS, list);
      StorageService.logActivity(reviewerEmail, 'Admin', 'Deletion Rejected', 'deletion-requests', `Rejected deletion for ${req.entityType || req.targetType}: ${req.entityTitle || req.targetName}`);
    }
  },
  deleteDeletionRequest(id: string): void {
    const list = StorageService.getDeletionRequests().filter((r) => r.id !== id);
    saveData(STORAGE_KEYS.DELETION_REQUESTS, list);
  },
  updateConnectionStatus(
    id: string,
    status: ConnectionRequest['status'],
    userEmail: string = 'admin@trigonlinks.pk',
    reason?: string
  ): void {
    const list = StorageService.getConnections();
    const conn = list.find((c) => c.id === id);
    if (conn) {
      conn.status = status;
      if (status === 'Rejected') {
        conn.rejectedAt = new Date().toISOString();
        if (reason) conn.rejectionReason = reason;
      } else if (status === 'Pending' || status === 'Approved' || status === 'Completed') {
        delete conn.rejectedAt;
        delete conn.rejectionReason;
      }
      if (reason) conn.notes = reason;
      saveData(STORAGE_KEYS.CONNECTIONS, list);
      StorageService.logActivity(
        userEmail,
        'Staff',
        `Connection ${status}`,
        'connections',
        `Connection for ${conn.customerName || conn.applicantName} marked ${status}`
      );
    }
  },

  requestDeletion(
    targetType: string,
    targetId: string,
    targetName: string,
    requestedBy: string,
    reason: string
  ): void {
    const req: DeletionRequest = {
      id: `del-${Date.now()}`,
      entityType: targetType,
      targetType,
      entityId: targetId,
      targetId,
      entityTitle: targetName,
      targetName,
      requestedBy,
      requestedByName: requestedBy,
      reason,
      status: 'Pending',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };
    StorageService.submitDeletionRequest(req, requestedBy);
  },

  resolveDeletionRequest(
    id: string,
    decision: 'Approved' | 'Rejected',
    reviewerEmail: string = 'admin@trigonlinks.pk'
  ): void {
    if (decision === 'Approved') {
      StorageService.approveDeletion(id, reviewerEmail);
    } else {
      StorageService.rejectDeletion(id, reviewerEmail);
    }
  },

  // Appwrite Cloud Synchronizer & Migrator
  /**
   * Pushes every collection to the server.
   *
   * This is a repair action, and it goes through the same authorized write path
   * as everything else: the server checks each record against the caller's role
   * and area and reports back what it refused. Credentials are stripped before
   * upload - they are owned by Appwrite accounts now, so pushing them would copy
   * secrets the browser should not hold.
   */
  async syncAllToAppwrite(): Promise<{ success: boolean; message: string; count: number }> {
    if (!AppwriteService.getIsConfigured()) {
      return { success: false, message: 'Not connected to the data service.', count: 0 };
    }

    try {
      await flushPendingWrites();

      const asRecords = (rows: Array<{ id: string }>) =>
        rows as unknown as Array<{ id: string }>;

      const dataset: Record<string, Array<{ id: string }>> = {
        customers: asRecords(StorageService.getCustomers()),
        packages: asRecords(StorageService.getPackages()),
        areas: asRecords(StorageService.getAreas()),
        connections: asRecords(StorageService.getConnections()),
        invoices: asRecords(StorageService.getInvoices()),
        payments: asRecords(StorageService.getPayments()),
        staff: asRecords(StorageService.getStaff()),
        complaints: asRecords(StorageService.getComplaints()),
        inventory: asRecords(StorageService.getInventory()),
        expenses: asRecords(StorageService.getExpenses()),
        activityLogs: asRecords(StorageService.getActivityLogs()),
        deletionRequests: asRecords(StorageService.getDeletionRequests()),
        announcements: asRecords(StorageService.getAnnouncements()),
        settings: asRecords([StorageService.getSettings()]),
      };

      return await pushBulk(dataset);
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Error occurred while pushing to the data service.',
        count: 0,
      };
    }
  },

  /**
   * Full pull across every collection.
   *
   * Each collection is handled independently: a failure on one no longer aborts
   * the rest, and a partial sync is reported as such instead of looking whole.
   */
  async pullAllFromAppwrite(): Promise<{ success: boolean; message: string; count: number }> {
    if (!AppwriteService.getIsConfigured()) {
      return { success: false, message: 'Not connected to the data service.', count: 0 };
    }

    let count = 0;
    const failed: string[] = [];

    for (const entry of SYNCED_COLLECTIONS) {
      try {
        const remote = (await AppwriteService.listDocs(entry.key)) as Array<{ id: string }>;
        if (remote.length === 0) continue;
        const { merged, changed } = mergeDeduplicated(entry.read(), remote);
        if (changed) entry.write(merged);
        count += remote.length;
      } catch (err) {
        failed.push(entry.key);
        console.warn(`[Sync] pull failed for ${entry.key}:`, err);
      }
    }

    try {
      StorageService.repairInvoiceLabels();
      StorageService.pruneExpiredConnections();
    } catch (err) {
      console.warn('[Sync] maintenance step failed:', err);
    }

    window.dispatchEvent(new Event('trigon_db_updated'));

    if (failed.length > 0) {
      return {
        success: false,
        message: `Pulled ${count} record(s); ${failed.join(', ')} could not be read.`,
        count,
      };
    }
    return {
      success: true,
      message: `Synchronised ${count} record(s) from the data service.`,
      count,
    };
  },

  // Full Database Snapshot for Google Drive / Local Backups
  getFullDatabaseSnapshot() {
    const settings = StorageService.getSettings();
    return {
      appName: 'Trigon Links ISP Suite',
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      summary: {
        totalCustomers: StorageService.getCustomers().length,
        totalInvoices: StorageService.getInvoices().length,
        totalPayments: StorageService.getPayments().length,
        totalComplaints: StorageService.getComplaints().length,
        totalStaff: StorageService.getStaff().length,
        totalPackages: StorageService.getPackages().length,
        totalAreas: StorageService.getAreas().length,
      },
      data: {
        settings: settings,
        customers: StorageService.getCustomers(),
        packages: StorageService.getPackages(),
        areas: StorageService.getAreas(),
        connections: StorageService.getConnections(),
        invoices: StorageService.getInvoices(),
        payments: StorageService.getPayments(),
        inventory: StorageService.getInventory(),
        staff: StorageService.getStaff(),
        expenses: StorageService.getExpenses(),
        complaints: StorageService.getComplaints(),
        messages: StorageService.getMessages(),
        announcements: StorageService.getAnnouncements(),
        activity_logs: StorageService.getActivityLogs(),
        deletion_requests: StorageService.getDeletionRequests(),
      },
    };
  },

  restoreFullDatabaseSnapshot(snapshot: any): { success: boolean; message: string; count: number } {
    try {
      if (!snapshot || !snapshot.data) {
        throw new Error('Invalid backup file format: Missing dataset.');
      }
      const data = snapshot.data;
      let count = 0;

      if (Array.isArray(data.customers)) {
        saveData(STORAGE_KEYS.CUSTOMERS, data.customers);
        count += data.customers.length;
      }
      if (Array.isArray(data.packages)) {
        saveData(STORAGE_KEYS.PACKAGES, data.packages);
        count += data.packages.length;
      }
      if (Array.isArray(data.areas)) {
        saveData(STORAGE_KEYS.AREAS, data.areas);
        count += data.areas.length;
      }
      if (Array.isArray(data.connections)) {
        saveData(STORAGE_KEYS.CONNECTIONS, data.connections);
        count += data.connections.length;
      }
      if (Array.isArray(data.invoices)) {
        saveData(STORAGE_KEYS.INVOICES, data.invoices);
        count += data.invoices.length;
      }
      if (Array.isArray(data.payments)) {
        saveData(STORAGE_KEYS.PAYMENTS, data.payments);
        count += data.payments.length;
      }
      if (Array.isArray(data.inventory)) {
        saveData(STORAGE_KEYS.INVENTORY, data.inventory);
        count += data.inventory.length;
      }
      if (Array.isArray(data.staff)) {
        saveData(STORAGE_KEYS.STAFF, data.staff);
        count += data.staff.length;
      }
      if (Array.isArray(data.expenses)) {
        saveData(STORAGE_KEYS.EXPENSES, data.expenses);
        count += data.expenses.length;
      }
      if (Array.isArray(data.complaints)) {
        saveData(STORAGE_KEYS.COMPLAINTS, data.complaints);
        count += data.complaints.length;
      }
      if (Array.isArray(data.messages)) {
        saveData(STORAGE_KEYS.MESSAGES, data.messages);
        count += data.messages.length;
      }
      if (Array.isArray(data.announcements)) {
        saveData(STORAGE_KEYS.ANNOUNCEMENTS, data.announcements);
        count += data.announcements.length;
      }
      if (Array.isArray(data.deletion_requests)) {
        saveData(STORAGE_KEYS.DELETION_REQUESTS, data.deletion_requests);
        count += data.deletion_requests.length;
      }
      if (data.settings && typeof data.settings === 'object') {
        saveData(STORAGE_KEYS.SETTINGS, data.settings);
      }

      window.dispatchEvent(new Event('trigon_db_updated'));

      StorageService.logActivity(
        'admin@trigonlinks.pk',
        'Super Admin',
        'Database Restored from Backup',
        'Settings',
        `Successfully restored ${count} total records from Google Drive / Cloud Backup.`
      );

      return {
        success: true,
        message: `Successfully restored ${count} records across all ISP modules!`,
        count,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to restore database from backup snapshot.',
        count: 0,
      };
    }
  },
};
registerSyncedCollections();



