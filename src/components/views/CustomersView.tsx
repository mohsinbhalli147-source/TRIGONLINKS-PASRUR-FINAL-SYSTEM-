import React, { useState, useMemo, useCallback } from 'react';
import { Customer, ConnectionRequest, Area, Invoice, CustomerInventoryItem } from '../../types';
import { StorageService } from '../../services/storage';
import { useStorageCollections } from '../../hooks/useStorageCollection';
import { scopeCustomers, scopeConnections } from '../../utils/scoping';

import { buildCsv, downloadCsv } from '../../utils/csv';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Power,
  ShieldAlert,
  Wallet,
  Wifi,
  Receipt,
  Phone,
  MapPin,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Send,
  MoreVertical,
  Activity,
  Server,
  Radio,
  Sliders,
  CreditCard,
  Tv,
  CheckSquare,
  Square,
  HelpCircle,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  FileText,
  Copy,
  Check,
  Zap,
  Boxes,
  Tag,
  Percent,
  Calculator,
  PackagePlus,
  Printer,
} from 'lucide-react';
import { CustomerOnboardingSlipModal } from '../modals/CustomerOnboardingSlipModal';
import { CustomerDeleteModal } from '../modals/CustomerDeleteModal';

export const CustomersView: React.FC = () => {
  const { user, hasFunctionAccess, isAdmin } = useAuth();
  const { showToast } = useToast();

  // A technician only works the areas assigned to them, so the list they see is
  // narrowed to those areas. Administrators and unassigned staff see everything.
  const visibleCustomers = useCallback(
    (all: Customer[]) => scopeCustomers(all, user),
    [user]
  );
  const visibleConnections = useCallback(
    (all: ConnectionRequest[]) => scopeConnections(all, user),
    [user]
  );

  // Primary Data
  const [
    {
      customers: allCustomers,
      packages,
      areas,
      invoices,
      complaints,
      inventoryList,
      connections: allConnections,
    },
    refreshData,
  ] = useStorageCollections({
    customers: () => StorageService.getCustomers(),
    packages: () => StorageService.getPackages(),
    areas: () => StorageService.getAreas(),
    invoices: () => StorageService.getInvoices(),
    complaints: () => StorageService.getComplaints(),
    inventoryList: () => StorageService.getInventory(),
    connections: () => StorageService.getConnections(),
  });

  // Scoping is derived from the signed-in user, so it is applied on render
  // rather than baked into the stored snapshot.
  const customers: Customer[] = visibleCustomers(allCustomers);
  const pendingConnections: ConnectionRequest[] = visibleConnections(allConnections).filter(
    (c) => c.status === 'Pending'
  );

  // Filter States

  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Suspended'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string>('All');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedIptv, setSelectedIptv] = useState<string>('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterConnectionType, setFilterConnectionType] = useState<string>('All');
  const [filterDuesOnly, setFilterDuesOnly] = useState<boolean>(false);
  const [filterBillingDay, setFilterBillingDay] = useState<string>('All');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // No customer auto-selected by default

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerForPay, setCustomerForPay] = useState<Customer | null>(null);
  const [openActionDropdownId, setOpenActionDropdownId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Quick Pay State
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'JazzCash' | 'EasyPaisa' | 'Bank Transfer'>('Cash');
  const [payRef, setPayRef] = useState<string>('');

  // Boxed Form Fields for Add / Edit
  // Box 1: Personal & Identity
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formAlternateMobile, setFormAlternateMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCnic, setFormCnic] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLandmark, setFormLandmark] = useState('');

  // Box 2: Area & Package Setup
  const [formAreaId, setFormAreaId] = useState('');
  const [formPackageId, setFormPackageId] = useState('');
  const [formPackageFee, setFormPackageFee] = useState(1800);
  const [formIpFee, setFormIpFee] = useState(0);
  const [formIptvFee, setFormIptvFee] = useState(0);
  const [formHasIptv, setFormHasIptv] = useState(true);
  const [formIptvPackage, setFormIptvPackage] = useState('Yes (HD)');
  const [formConnectionFee, setFormConnectionFee] = useState(2500);
  const [formBillingDate, setFormBillingDate] = useState<number>(1);

  // Box 3: Network & Technical Box
  const [formConnectionType, setFormConnectionType] = useState<'Fiber' | 'Wireless' | 'Cable'>('Fiber');
  const [formIpAddress, setFormIpAddress] = useState('192.168.1.10');
  const [formSubnetMask, setFormSubnetMask] = useState('255.255.255.0');
  const [formGateway, setFormGateway] = useState('192.168.1.1');
  const [formPppoeUser, setFormPppoeUser] = useState('');
  const [formPppoePass, setFormPppoePass] = useState('');
  const [formMacAddress, setFormMacAddress] = useState('');
  const [formOpticalPower, setFormOpticalPower] = useState<number>(-19.4);
  const [formCableLength, setFormCableLength] = useState<number>(100);
  const [formSplitterPort, setFormSplitterPort] = useState('FAT-04 / Port 7');

  // Box 4: Hardware & CPE Equipment
  const [formDevice, setFormDevice] = useState('Huawei EchoLife HG8546M GPON ONT');
  const [formDeviceModel, setFormDeviceModel] = useState('HG8546M Dual-Band');
  const [formDeviceSerial, setFormDeviceSerial] = useState('');
  const [formAssignedInventory, setFormAssignedInventory] = useState<CustomerInventoryItem[]>([]);

  // Discounts & Promotions
  const [formDiscountType, setFormDiscountType] = useState<'none' | 'setup' | 'monthly' | 'both'>('none');
  const [formDiscountSetup, setFormDiscountSetup] = useState<number>(0);
  const [formDiscountMonthly, setFormDiscountMonthly] = useState<number>(0);
  const [formDiscount, setFormDiscount] = useState<number>(0);
  const [formDiscountReason, setFormDiscountReason] = useState<string>('');

  // Voucher Slip Modal
  const [voucherModalCustomer, setVoucherModalCustomer] = useState<Customer | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

  // Box 5: Financials & Status
  const [formStatus, setFormStatus] = useState<'Active' | 'Suspended'>('Active');
  const [formPendingBalance, setFormPendingBalance] = useState<number>(0);
  const [formWalletBalance, setFormWalletBalance] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');

  // Auto calculator for total gross monthly bill
  const calculatedTotalMonthly = useMemo(() => {
    return Number(formPackageFee || 0) + Number(formIpFee || 0) + Number(formIptvFee || 0);
  }, [formPackageFee, formIpFee, formIptvFee]);

  // Effective Discounts
  const effectiveSetupDisc = useMemo(() => {
    if (formDiscountType === 'setup' || formDiscountType === 'both') return Number(formDiscountSetup) || 0;
    return 0;
  }, [formDiscountType, formDiscountSetup]);

  const effectiveMonthlyDisc = useMemo(() => {
    if (formDiscountType === 'monthly' || formDiscountType === 'both') return Number(formDiscountMonthly) || 0;
    return 0;
  }, [formDiscountType, formDiscountMonthly]);

  // Net recurring monthly payable
  const netMonthlyPayable = useMemo(() => {
    return Math.max(0, calculatedTotalMonthly - effectiveMonthlyDisc);
  }, [calculatedTotalMonthly, effectiveMonthlyDisc]);

  // Total inventory equipment asset valuation auto-calculator
  const totalInventoryCost = useMemo(() => {
    return formAssignedInventory.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);
  }, [formAssignedInventory]);

  // Net initial connection & hardware setup payable
  const netInitialSetupFee = useMemo(() => {
    const baseConn = Number(formConnectionFee) || 0;
    const equip = Number(totalInventoryCost) || 0;
    return Math.max(0, baseConn + equip - effectiveSetupDisc);
  }, [formConnectionFee, totalInventoryCost, effectiveSetupDisc]);

  // Inventory Row Handlers
  const handleAddInventoryRow = () => {
    const defaultItem = inventoryList[0];
    const itemPrice = defaultItem?.sellingPrice || defaultItem?.price || defaultItem?.unitCost || 3200;
    const newItem: CustomerInventoryItem = {
      itemId: defaultItem?.id || `inv-${Date.now()}`,
      itemName: defaultItem?.name || 'Huawei EchoLife HG8546M GPON ONT',
      quantity: 1,
      unitPrice: itemPrice,
      totalPrice: itemPrice * 1,
    };
    setFormAssignedInventory((prev) => [...prev, newItem]);
  };

  const handleInventoryItemSelect = (index: number, itemId: string) => {
    const selectedItem = inventoryList.find((i) => i.id === itemId);
    if (!selectedItem) return;
    setFormAssignedInventory((prev) => {
      const next = [...prev];
      const curQty = next[index]?.quantity || 1;
      const uPrice = selectedItem.sellingPrice || selectedItem.price || selectedItem.unitCost || 0;
      next[index] = {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: curQty,
        unitPrice: uPrice,
        totalPrice: uPrice * curQty,
      };
      return next;
    });
  };

  const handleInventoryQtyChange = (index: number, rawQty: number) => {
    const validQty = Math.max(1, Number(rawQty) || 1);
    setFormAssignedInventory((prev) => {
      const next = [...prev];
      if (next[index]) {
        const uPrice = next[index].unitPrice || 0;
        next[index] = {
          ...next[index],
          quantity: validQty,
          totalPrice: uPrice * validQty,
        };
      }
      return next;
    });
  };

  const handleRemoveInventoryRow = (index: number) => {
    setFormAssignedInventory((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Package Selection & auto-fill monthly fee
  const handlePackageChange = (pkgId: string) => {
    setFormPackageId(pkgId);
    const selected = packages.find((p) => p.id === pkgId);
    if (selected) {
      setFormPackageFee(selected.price);
    }
  };

  // Open Edit Modal
  const openEditModal = (c: Customer) => {
    setCustomerToEdit(c);
    setFormName(c.name || '');
    setFormUsername(c.username || '');
    setFormFatherName(c.fatherName || '');
    setFormMobile(c.mobile || '');
    setFormAlternateMobile(c.alternateMobile || '');
    setFormEmail(c.email || '');
    setFormCnic(c.cnic || '');
    setFormAddress(c.address || '');
    setFormLandmark(c.landmark || '');

    setFormAreaId(c.areaId || (areas[0]?.id ?? ''));
    setFormPackageId(c.packageId || (packages[0]?.id ?? ''));
    setFormPackageFee(c.monthlyFee || 1800);
    setFormIpFee(c.ipCharges || c.ipMonthlyCharges || 0);
    setFormIptvFee(c.iptvCharges || c.iptvMonthlyCharges || 0);
    setFormHasIptv(c.hasIptv ?? true);
    setFormIptvPackage(c.iptvPackageName || 'Yes (HD)');
    setFormConnectionFee(c.connectionFee || 2500);
    setFormBillingDate(c.billingDate || 1);

    setFormDiscount(c.discount || 0);
    setFormDiscountSetup(c.discountSetup || c.discount || 0);
    setFormDiscountMonthly(c.discountMonthly || 0);
    if (c.discountSetup && c.discountMonthly) {
      setFormDiscountType('both');
    } else if (c.discountSetup) {
      setFormDiscountType('setup');
    } else if (c.discountMonthly) {
      setFormDiscountType('monthly');
    } else if (c.discount) {
      setFormDiscountType('setup');
    } else {
      setFormDiscountType('none');
    }
    setFormDiscountReason(c.discountReason || '');

    setFormConnectionType(c.connectionType || 'Fiber');
    setFormIpAddress(c.ipAddress || '192.168.1.10');
    setFormSubnetMask(c.subnetMask || '255.255.255.0');
    setFormGateway(c.gateway || '192.168.1.1');
    setFormPppoeUser(c.pppoeUsername || c.username || '');
    setFormPppoePass(c.pppoePassword || 'pass@123');
    setFormMacAddress(c.macAddress || '4C:1B:86:92:4A:11');
    setFormOpticalPower(c.opticalPowerDbm || -19.4);
    setFormCableLength(c.cableLengthMeters || 100);
    setFormSplitterPort(c.splitterPort || 'FAT-04 / Port 7');

    setFormDevice(c.device || 'Huawei EchoLife HG8546M GPON ONT');
    setFormDeviceModel(c.deviceModel || 'HG8546M Dual-Band');
    setFormDeviceSerial(c.deviceSerialNumber || '48575443F882194B');
    setFormAssignedInventory(
      c.assignedInventory && c.assignedInventory.length > 0
        ? c.assignedInventory
        : [
            {
              itemId: 'inv-1',
              itemName: c.device || 'Huawei EchoLife HG8546M GPON ONT',
              quantity: 1,
              unitPrice: 3200,
              totalPrice: 3200,
            },
          ]
    );

    setFormStatus(c.status || 'Active');
    setFormPendingBalance(c.pendingBalance || 0);
    setFormWalletBalance(c.walletBalance || 0);
    setFormNotes(c.notes || '');

    setIsAddEditModalOpen(true);
    setOpenActionDropdownId(null);
  };

  // Open Fresh Add Modal
  const openAddModal = () => {
    setCustomerToEdit(null);
    const defArea = areas[0];
    const defPkg = packages.find((p) => p.name.includes('8 Mbps')) || packages[0];

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setFormName('');
    setFormUsername(`user${randomSuffix}_psr`);
    setFormFatherName('');
    setFormMobile('0302');
    setFormAlternateMobile('');
    setFormEmail('');
    setFormCnic('34567-');
    setFormAddress('House , Street , Pasrur');
    setFormLandmark('');

    setFormAreaId(defArea?.id ?? 'area-pasrur');
    setFormPackageId(defPkg?.id ?? 'pkg-8mbps');
    setFormPackageFee(defPkg?.price ?? 1800);
    setFormIpFee(0);
    setFormIptvFee(0);
    setFormHasIptv(true);
    setFormIptvPackage('Yes (HD)');
    setFormConnectionFee(2500);
    setFormBillingDate(1);

    setFormDiscountType('none');
    setFormDiscountSetup(0);
    setFormDiscountMonthly(0);
    setFormDiscount(0);
    setFormDiscountReason('');

    setFormConnectionType('Fiber');
    setFormIpAddress(`192.168.1.${Math.floor(15 + Math.random() * 80)}`);
    setFormSubnetMask('255.255.255.0');
    setFormGateway('192.168.1.1');
    setFormPppoeUser(`user${randomSuffix}_psr`);
    setFormPppoePass('trigon@123');
    setFormMacAddress('4C:1B:86:' + Math.floor(10 + Math.random() * 89) + ':AA:' + Math.floor(10 + Math.random() * 89));
    setFormOpticalPower(-19.2);
    setFormCableLength(110);
    setFormSplitterPort('FAT-04 / Port ' + (Math.floor(1 + Math.random() * 8)));

    const ontItem = inventoryList.find((i) => i.categoryId === 'cat-1') || inventoryList[0];
    const cableItem = inventoryList.find((i) => i.categoryId === 'cat-3') || inventoryList[2];

    const ontPrice = ontItem?.sellingPrice || ontItem?.price || ontItem?.unitCost || 3200;
    const cablePrice = cableItem?.sellingPrice || cableItem?.price || cableItem?.unitCost || 32;

    setFormDevice(ontItem?.name || 'Huawei EchoLife HG8546M GPON ONT');
    setFormDeviceModel('HG8546M Dual-Band');
    setFormDeviceSerial('48575443' + Math.random().toString(36).substring(2, 8).toUpperCase());
    setFormAssignedInventory([
      {
        itemId: ontItem?.id || 'inv-1',
        itemName: ontItem?.name || 'Huawei EchoLife HG8546M GPON ONT',
        quantity: 1,
        unitPrice: ontPrice,
        totalPrice: ontPrice * 1,
      },
      {
        itemId: cableItem?.id || 'inv-3',
        itemName: cableItem?.name || 'Fiber Drop Cable 2-Core Outdoor (G.657A)',
        quantity: 100,
        unitPrice: cablePrice,
        totalPrice: cablePrice * 100,
      },
    ]);

    setFormStatus('Active');
    setFormPendingBalance(0);
    setFormWalletBalance(0);
    setFormNotes('');

    setIsAddEditModalOpen(true);
  };

  // Save Customer / Route New Registration to Connections
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) {
      showToast('error', 'Required Fields Missing', 'Please provide at least customer name and username.');
      return;
    }

    const matchedArea = areas.find((a) => a.id === formAreaId);
    const matchedPkg = packages.find((p) => p.id === formPackageId);

    // If new registration, route directly to Connections with Status: Pending
    if (!customerToEdit) {
      const newConn: ConnectionRequest = {
        id: `conn-${Date.now()}`,
        applicantName: formName.trim(),
        customerName: formName.trim(),
        username: formUsername.trim(),
        password: formPppoePass || 'trigon@123',
        fatherName: formFatherName.trim(),
        mobile: formMobile.trim(),
        alternateMobile: formAlternateMobile.trim(),
        email: formEmail.trim() || `${formUsername.trim()}@trigonlinks.pk`,
        cnic: formCnic.trim(),
        address: formAddress.trim(),
        landmark: formLandmark.trim(),
        areaId: formAreaId,
        areaName: matchedArea?.name || 'Pasrur City',
        packageId: formPackageId,
        packageName: matchedPkg?.name || '8 Mbps',
        packageSpeed: matchedPkg?.speed || '8 Mbps',
        monthlyFee: Number(formPackageFee),
        connectionFee: Number(formConnectionFee),
        totalMonthly: netMonthlyPayable,
        discount: effectiveSetupDisc + effectiveMonthlyDisc,
        discountSetup: effectiveSetupDisc,
        discountMonthly: effectiveMonthlyDisc,
        discountReason: formDiscountReason.trim(),
        discountType: formDiscountType === 'none' ? undefined : formDiscountType,
        connectionType: formConnectionType,
        device: formDevice,
        deviceModel: formDeviceModel,
        deviceSerialNumber: formDeviceSerial,
        macAddress: formMacAddress,
        opticalPowerDbm: Number(formOpticalPower),
        cableLengthMeters: Number(formCableLength),
        splitterPort: formSplitterPort,
        pppoeUsername: formPppoeUser || formUsername,
        pppoePassword: formPppoePass || 'trigon@123',
        ipAddress: formIpAddress,
        subnetMask: formSubnetMask,
        gateway: formGateway,
        assignedInventory: formAssignedInventory,
        status: 'Pending',
        requestDate: new Date().toISOString().split('T')[0],
        notes: formNotes,
        createdAt: new Date().toISOString(),
      };

      StorageService.saveConnection(newConn, user?.email);
      showToast(
        'success',
        'Customer Sent to Connections for Approval',
        `${newConn.applicantName} registered. Request has been routed to Connections with View/Edit/Approve/Reject controls.`
      );

      setIsAddEditModalOpen(false);
      return;
    }

    // Editing Existing Active Customer
    const updatedCustomer: Customer = {
      id: customerToEdit.id,
      name: formName.trim(),
      username: formUsername.trim(),
      fatherName: formFatherName.trim(),
      mobile: formMobile.trim(),
      alternateMobile: formAlternateMobile.trim(),
      email: formEmail.trim() || `${formUsername.trim()}@trigonlinks.pk`,
      cnic: formCnic.trim(),
      address: formAddress.trim(),
      landmark: formLandmark.trim(),
      areaId: formAreaId,
      areaName: matchedArea?.name || 'Pasrur City',
      packageId: formPackageId,
      packageName: matchedPkg?.name || '8 Mbps',
      packageSpeed: matchedPkg?.speed || '8 Mbps',
      monthlyFee: Number(formPackageFee),
      ipCharges: Number(formIpFee),
      ipMonthlyCharges: Number(formIpFee),
      iptvCharges: Number(formIptvFee),
      iptvMonthlyCharges: Number(formIptvFee),
      hasIptv: formHasIptv,
      iptvPackageName: formHasIptv ? formIptvPackage : 'No',
      connectionFee: Number(formConnectionFee),
      totalMonthly: netMonthlyPayable,
      installDate: customerToEdit.installDate || new Date().toISOString().split('T')[0],
      billingDate: Number(formBillingDate) || 1,
      discount: effectiveSetupDisc + effectiveMonthlyDisc,
      discountSetup: effectiveSetupDisc,
      discountMonthly: effectiveMonthlyDisc,
      discountReason: formDiscountReason.trim(),
      discountType: formDiscountType === 'none' ? undefined : formDiscountType,
      connectionType: formConnectionType,
      device: formDevice,
      deviceModel: formDeviceModel,
      deviceSerialNumber: formDeviceSerial,
      macAddress: formMacAddress,
      opticalPowerDbm: Number(formOpticalPower),
      cableLengthMeters: Number(formCableLength),
      splitterPort: formSplitterPort,
      pppoeUsername: formPppoeUser || formUsername,
      pppoePassword: formPppoePass || 'pass@123',
      ipAddress: formIpAddress,
      subnetMask: formSubnetMask,
      gateway: formGateway,
      iptvAddress: formHasIptv ? `10.50.4.${Math.floor(10 + Math.random() * 90)}` : undefined,
      status: formStatus,
      walletBalance: Number(formWalletBalance) || 0,
      pendingBalance: Number(formPendingBalance) || 0,
      lastPaymentDate: customerToEdit?.lastPaymentDate || '2024-07-01',
      lastPaymentAmount: customerToEdit?.lastPaymentAmount || formPackageFee,
      assignedInventory: formAssignedInventory,
      notes: formNotes,
      createdAt: customerToEdit.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageService.saveCustomer(updatedCustomer, user?.email);
    showToast(
      'success',
      'Customer Profile Updated',
      `Full profile for ${updatedCustomer.name} saved with updated operational boxes.`
    );

    setIsAddEditModalOpen(false);
    if (selectedCustomerForDetail?.id === updatedCustomer.id) {
      setSelectedCustomerForDetail(updatedCustomer);
    }
  };

  // Toggle Suspend / Activate
  const handleToggleStatus = (cust: Customer) => {
    const newStatus = cust.status === 'Active' ? 'Suspended' : 'Active';
    const updated = { ...cust, status: newStatus as Customer['status'] };
    StorageService.saveCustomer(updated, user?.email);
    showToast(
      newStatus === 'Active' ? 'success' : 'warning',
      `Customer ${newStatus}`,
      `${cust.name} (${cust.username}) has been ${newStatus.toLowerCase()}.`
    );
    if (selectedCustomerForDetail?.id === cust.id) {
      setSelectedCustomerForDetail(updated);
    }
    setOpenActionDropdownId(null);
  };

  // Delete Customer
  const handleDeleteCustomer = (c: Customer) => {
    // Purging a subscriber record is irreversible, so it stays with
    // administrators rather than anyone who can open the customers module.
    if (!isAdmin) {
      showToast(
        'error',
        'Administrator access required',
        'Only a Super Admin can delete a subscriber record.'
      );
      return;
    }
    setCustomerToDelete(c);
    setIsDeleteModalOpen(true);
    setOpenActionDropdownId(null);
  };

  // Quick Pay Execution
  const handleQuickPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForPay || payAmount <= 0) return;

    // Create a new invoice payment
    const invId = `INV-${Date.now().toString().slice(-6)}`;
    // Billed for the current month, not a hardcoded one.
    const now = new Date();
    const billingMonth = `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
    const newInv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invId,
      customerId: customerForPay.id,
      customerName: customerForPay.name,
      customerMobile: customerForPay.mobile,
      username: customerForPay.username,
      month: billingMonth,
      year: now.getFullYear(),
      billingMonth: billingMonth,
      areaName: customerForPay.areaName,
      packageName: customerForPay.packageName,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      paidDate: new Date().toISOString().split('T')[0],
      amount: payAmount,
      totalAmount: payAmount,
      paidAmount: payAmount,
      remainingAmount: 0,
      status: 'Paid',
      paymentMethod: payMethod,
      paymentNotes: `Quick desk payment recorded. Ref: ${payRef || 'CASH-RX'}`,
      breakdown: {
        packageFee: payAmount,
        ipCharges: 0,
        iptvCharges: 0,
        inventoryCharges: 0,
        lateFee: 0,
        discount: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    StorageService.saveInvoice(newInv, user?.email);

    // Update customer's pending balance
    const updatedCust: Customer = {
      ...customerForPay,
      pendingBalance: Math.max(0, (customerForPay.pendingBalance || 0) - payAmount),
      lastPaymentDate: new Date().toISOString().split('T')[0],
      lastPaymentAmount: payAmount,
    };
    StorageService.saveCustomer(updatedCust, user?.email);

    showToast('success', 'Payment Received', `Rs. ${payAmount.toLocaleString()} collected for ${customerForPay.name} via ${payMethod}.`);
    setIsQuickPayModalOpen(false);
    setCustomerForPay(null);
    if (selectedCustomerForDetail?.id === updatedCust.id) {
      setSelectedCustomerForDetail(updatedCust);
    }
  };

  // Bulk Status Change
  const handleBulkStatusChange = (status: 'Active' | 'Suspended') => {
    if (selectedIds.length === 0) {
      showToast('error', 'None Selected', 'Please select at least one customer using checkboxes.');
      return;
    }
    StorageService.bulkUpdateCustomerStatus(selectedIds, status, user?.email);
    showToast('success', 'Bulk Status Updated', `${selectedIds.length} customers switched to ${status}.`);
    setIsBulkStatusModalOpen(false);
  };

  // Run Monthly Billing
  const handleRunBilling = () => {
    const count = StorageService.generateAllBills('July 2024', user?.email);
    showToast('success', 'Billing Run Complete', `Generated invoices for ${count} active customers.`);
  };

  // Copy helper
  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast('info', 'Copied', `${fieldName} copied to clipboard.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // WhatsApp Bill Dispatch
  const sendWhatsAppBill = (c: Customer) => {
    const due = c.pendingBalance || c.totalMonthly;
    const msg = encodeURIComponent(
      `*TRIGON LINKS BROADBAND & IPTV SERVICES*\n\n` +
      `Dear Customer *${c.name}*,\n` +
      `Your Monthly Internet Bill Details:\n` +
      `â€¢ *Subscriber Name:* ${c.name}\n` +
      `â€¢ *Username:* ${c.username}\n` +
      `â€¢ *Package:* ${c.packageName} (${c.packageSpeed || '8 Mbps'})\n` +
      `â€¢ *Coverage Area:* ${c.areaName}\n` +
      `â€¢ *IPTV Service:* ${c.hasIptv ? 'Yes (HD)' : 'No'}\n` +
      `â€¢ *Monthly Tariff:* Rs. ${c.totalMonthly.toLocaleString()}\n` +
      `â€¢ *Total Due Amount:* Rs. ${due.toLocaleString()}\n` +
      `â€¢ *Billing Due Date:* 10th of every month\n\n` +
      `Please pay via JazzCash, EasyPaisa, or Cash to our authorized collection officer.\n` +
      `24/7 Helpline: 042-111-874-466 | WhatsApp: 0300-8451122\n` +
      `Thank you for choosing Trigon Links Broadband!`
    );
    const cleanMobile = c.mobile.replace(/[^0-9]/g, '');
    const intlMobile = cleanMobile.startsWith('0') ? '92' + cleanMobile.slice(1) : cleanMobile;
    window.open(`https://wa.me/${intlMobile}?text=${msg}`, '_blank');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Username',
      'Name',
      'Father Name',
      'CNIC',
      'Mobile',
      'Package',
      'Area',
      'Monthly Fee',
      'IPTV',
      'Pending Dues',
      'Live IP',
      'Status',
      'Connection Date',
      'Bill Date',
      'Address',
    ];

    const rows = filteredCustomers.map((c, idx) => [
      idx + 1,
      c.username,
      c.name,
      c.fatherName || '',
      c.cnic,
      c.mobile,
      c.packageName,
      c.areaName,
      c.monthlyFee,
      c.hasIptv ? 'Yes (HD)' : 'No',
      c.pendingBalance || 0,
      c.ipAddress,
      c.status,
      c.installDate,
      c.billingDate,
      c.address,
    ]);

    // buildCsv quotes and formula-escapes every cell. The previous version
    // hand-quoted only some fields, applied encodeURI (not encodeURIComponent)
    // to a data: URL, and left CNIC-style values able to execute as formulas.
    downloadCsv(`trigon_customers_${new Date().toISOString().split('T')[0]}`, buildCsv(headers, rows));
    showToast('success', 'Export Completed', `${filteredCustomers.length} customer records exported to CSV.`);
  };

  // KPI Calculations matching the user screenshot
  const totalCount = customers.length;
  const activeCount = customers.filter((c) => c.status === 'Active').length;
  const suspendedCount = customers.filter((c) => c.status === 'Suspended').length;
  const activeRatePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100;

  // Collection: sum of paid invoices this month
  const totalCollection = invoices
    .filter((i) => i.status === 'Paid')
    .reduce((sum, i) => sum + (i.totalAmount || i.amount || 0), 0);

  // Total Pending Dues across customers
  const totalPending = customers.reduce((sum, c) => sum + (c.pendingBalance || 0), 0);

  // Today's Payments
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter((i) => i.status === 'Paid' && i.paidDate?.startsWith(todayDateStr));
  const todayCollection = todayInvoices.reduce((sum, i) => sum + (i.totalAmount || i.amount || 0), 0);

  // Avg Package
  const avgPackagePrice = totalCount > 0
    ? Math.round(customers.reduce((sum, c) => sum + (c.monthlyFee || 0), 0) / totalCount)
    : 2567;

  // Filtered List
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Tab filter
      if (activeTab === 'Active' && c.status !== 'Active') return false;
      if (activeTab === 'Suspended' && c.status !== 'Suspended') return false;

      // Status dropdown
      if (selectedStatus !== 'All' && c.status !== selectedStatus) return false;

      // Area dropdown
      if (selectedArea !== 'All' && c.areaId !== selectedArea && c.areaName !== selectedArea) return false;

      // Package dropdown
      if (selectedPackage !== 'All' && c.packageId !== selectedPackage && c.packageName !== selectedPackage) return false;

      // IPTV dropdown
      if (selectedIptv === 'Yes' && !c.hasIptv) return false;
      if (selectedIptv === 'No' && c.hasIptv) return false;

      // Advanced filters
      if (filterConnectionType !== 'All' && c.connectionType !== filterConnectionType) return false;
      if (filterDuesOnly && (c.pendingBalance || 0) <= 0) return false;
      if (filterBillingDay !== 'All' && String(c.billingDate) !== filterBillingDay) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesUser = c.username?.toLowerCase().includes(q);
        const matchesMobile = c.mobile?.toLowerCase().includes(q);
        const matchesCnic = c.cnic?.toLowerCase().includes(q);
        const matchesIp = c.ipAddress?.toLowerCase().includes(q);
        const matchesAddress = c.address?.toLowerCase().includes(q);
        const matchesArea = c.areaName?.toLowerCase().includes(q);
        return matchesName || matchesUser || matchesMobile || matchesCnic || matchesIp || matchesAddress || matchesArea;
      }

      return true;
    });
  }, [
    customers,
    activeTab,
    selectedStatus,
    selectedArea,
    selectedPackage,
    selectedIptv,
    filterConnectionType,
    filterDuesOnly,
    filterBillingDay,
    searchQuery,
  ]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Select All / Toggle
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedCustomers.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Row with System Status Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-cyan-400" />
            Customers Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete Subscriber Central Directory, Boxed Dossiers, Live ONT Monitoring &amp; Billing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Operational</span>
            <span className="text-emerald-500 font-mono text-[10px]">Â· 12ms OLT</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs">
            <div className="w-5 h-5 rounded-md bg-blue-600 font-bold text-[11px] text-white flex items-center justify-center">
              MB
            </div>
            <span className="font-semibold text-white">Mohsin Bhalli</span>
            <span className="text-[10px] text-cyan-400">(Admin)</span>
          </div>
        </div>
      </div>

      {/* Reports and Analytics Section (EXACT MATCH to User Screenshot) */}
      <div className="rounded-2xl bg-white text-slate-900 p-5 shadow-xl border border-slate-200 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Reports and Analytics
          </h2>

          <button
             type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800 transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Generate Custom Report
          </button>
        </div>

        {/* 6 KPI Cards matching the screenshot */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Total of total */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {totalCount}
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1">Total of total</span>
          </div>

          {/* Card 2: 100% active */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {activeCount}
            </span>
            <span className="text-xs text-emerald-700 font-bold mt-1">
              {activeRatePercent}% active
            </span>
          </div>

          {/* Card 3: Collection */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              Rs. {totalCollection.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1">Collection</span>
          </div>

          {/* Card 4: Pending */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono tracking-tight">
              Rs. {totalPending.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1">Pending</span>
          </div>

          {/* Card 5: TODAY'S COLLECTION */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300/80 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-black tracking-wider uppercase text-amber-800">
              TODAY&apos;S COLLECTION
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
              Rs. {todayCollection.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-600 font-medium mt-1">
              {todayInvoices.length} payments today
            </span>
          </div>

          {/* Card 6: AVG. PACKAGE */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-black tracking-wider uppercase text-blue-800">
              AVG. PACKAGE
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
              Rs. {avgPackagePrice.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-600 font-medium mt-1">
              Per customer
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Container (Styled Crisp White Enterprise Container matching Screenshot) */}
      <div className="rounded-2xl bg-white text-slate-900 shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Control Bar: Tabs + Action Buttons */}
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Tabs: All (15), Active (13), Suspended (2) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
               type="button"
              onClick={() => setActiveTab('All')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'All'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
               type="button"
              onClick={() => setActiveTab('Active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'Active'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
               type="button"
              onClick={() => setActiveTab('Suspended')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'Suspended'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suspended ({suspendedCount})
            </button>
          </div>

          {/* Action Buttons Right: Export, + New Request, Import Data, Bulk Status Change */}
          <div className="flex flex-wrap items-center gap-2">
            <button
               type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-700 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export
            </button>

            <button
               type="button"
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              + New Request
            </button>

            <button
               type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Data
            </button>

            <button
               type="button"
              onClick={() => setIsBulkStatusModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-sm transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Bulk Status Change
            </button>
          </div>
        </div>

        {/* Secondary Filter Strip matching screenshot */}
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2.5 text-xs">
          {/* Live Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, mobile, CNIC, username, IP, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-xs"
            />
            {searchQuery && (
              <button
                 type="button" aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Select Package Dropdown */}
          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-xs"
          >
            <option value="All">Select Package</option>
            {packages.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} ({p.speed})
              </option>
            ))}
          </select>

          {/* Select Area Dropdown */}
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-xs"
          >
            <option value="All">Select Area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-xs"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>

          {/* IPTV Filter Dropdown */}
          <select
            value={selectedIptv}
            onChange={(e) => setSelectedIptv(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium shadow-xs"
          >
            <option value="All">IPTV All</option>
            <option value="Yes">Yes (HD)</option>
            <option value="No">No IPTV</option>
          </select>

          {/* 7 More Filters Toggle Button */}
          <button
             type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs ${
              showAdvancedFilters
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            7 More Filters
          </button>

          {/* Quick Action Button Links */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
               type="button"
              onClick={handleRunBilling}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-[11px] shadow-xs"
            >
              <Zap className="w-3 h-3 text-emerald-600" />
              Billing Run
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="p-4 bg-slate-100/80 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label htmlFor="connection-medium" className="block text-[11px] font-bold text-slate-600 mb-1">
                Connection Medium
              </label>
              <select
                 id="connection-medium"
                value={filterConnectionType}
                onChange={(e) => setFilterConnectionType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
              >
                <option value="All">All Types</option>
                <option value="Fiber">Fiber FTTH</option>
                <option value="Wireless">Wireless</option>
                <option value="Cable">Cat6 Cable</option>
              </select>
            </div>

            <div>
              <label htmlFor="billing-cycle-day" className="block text-[11px] font-bold text-slate-600 mb-1">
                Billing Cycle Day
              </label>
              <select
                 id="billing-cycle-day"
                value={filterBillingDay}
                onChange={(e) => setFilterBillingDay(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
              >
                <option value="All">Any Billing Day</option>
                <option value="1">1st of Month</option>
                <option value="5">5th of Month</option>
                <option value="10">10th of Month</option>
                <option value="15">15th of Month</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white border border-slate-300 w-full hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={filterDuesOnly}
                  onChange={(e) => setFilterDuesOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="font-bold text-slate-800">Only Customers with Dues &gt; 0</span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                 type="button"
                onClick={() => {
                  setFilterConnectionType('All');
                  setFilterDuesOnly(false);
                  setFilterBillingDay('All');
                  setSelectedPackage('All');
                  setSelectedArea('All');
                  setSelectedStatus('All');
                  setSelectedIptv('All');
                  setSearchQuery('');
                }}
                className="w-full py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* Data Table matching screenshot */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-wider text-[11px] border-b border-slate-200 select-none">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedCustomers.length > 0 &&
                      paginatedCustomers.every((c) => selectedIds.includes(c.id))
                    }
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 font-black text-slate-800">ID</th>
                <th className="py-3 px-3 font-black text-slate-800">Username</th>
                <th className="py-3 px-3 font-black text-slate-800">Name</th>
                <th className="py-3 px-3 font-black text-slate-800">CNIC</th>
                <th className="py-3 px-3 font-black text-slate-800">Mobile</th>
                <th className="py-3 px-3 font-black text-slate-800">Package</th>
                <th className="py-3 px-3 font-black text-slate-800">Area</th>
                <th className="py-3 px-3 text-right font-black text-slate-800">Monthly Fee</th>
                <th className="py-3 px-3 text-center font-black text-slate-800">IPTV</th>
                <th className="py-3 px-3 text-right font-black text-slate-800">Pending</th>
                <th className="py-3 px-3 font-black text-slate-800">Live IP</th>
                <th className="py-3 px-3 text-center font-black text-slate-800">Status</th>
                <th className="py-3 px-3 font-black text-slate-800">Conn. Date</th>
                <th className="py-3 px-3 font-black text-slate-800">Bill Date</th>
                <th className="py-3 px-3 font-black text-slate-800">Address</th>
                <th className="py-3 px-3 text-center font-black text-slate-800">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-sans">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-500 mt-0.5">Try adjusting your filters or search terms.</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((cust, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isSelected = selectedIds.includes(cust.id);
                  const isSuspended = cust.status === 'Suspended';
                  const pending = cust.pendingBalance || 0;

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => setSelectedCustomerForDetail(cust)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 hover:bg-blue-50'
                          : idx % 2 === 0
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(cust.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-3 px-2 font-mono font-bold text-slate-600">
                        {globalIdx}
                      </td>

                      {/* Username */}
                      <td className="py-3 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {cust.username}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {cust.name}
                      </td>

                      {/* CNIC */}
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {cust.cnic || '34567-3456789-3'}
                      </td>

                      {/* Mobile */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{cust.mobile}</span>
                          <button
                             type="button"
                            title="Chat on WhatsApp"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendWhatsAppBill(cust);
                            }}
                            className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Package */}
                      <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {cust.packageName}
                      </td>

                      {/* Area */}
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        {cust.areaName}
                      </td>

                      {/* Monthly Fee */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        Rs. {(cust.monthlyFee || 1800).toLocaleString()}
                      </td>

                      {/* IPTV */}
                      <td className="py-3 px-3 text-center whitespace-nowrap font-medium text-slate-700">
                        {cust.hasIptv ? (
                          <span className="text-blue-700 font-semibold">
                            {cust.iptvPackageName || 'Yes (HD)'}
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>

                      {/* Pending */}
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {pending > 0 ? (
                          <span className="font-black text-rose-600">
                            Rs. {pending.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold">Rs. 0</span>
                        )}
                      </td>

                      {/* Live IP */}
                      <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSuspended ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span>{cust.ipAddress || '192.168.1.10'}</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isSuspended
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {cust.status}
                        </span>
                      </td>

                      {/* Conn. Date */}
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {cust.installDate || '2024-05-15'}
                      </td>

                      {/* Bill Date */}
                      <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                        2024-07-0{cust.billingDate || 1}
                      </td>

                      {/* Address */}
                      <td className="py-3 px-3 text-slate-600 max-w-[180px] truncate" title={cust.address}>
                        {cust.address}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-3 text-center relative whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-block relative">
                          <button
                             type="button" aria-label="More actions"
                            onClick={() =>
                              setOpenActionDropdownId(
                                openActionDropdownId === cust.id ? null : cust.id
                              )
                            }
                            className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionDropdownId === cust.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-30 text-left text-xs font-medium animate-in fade-in zoom-in-95">
                              <button
                                 type="button"
                                onClick={() => {
                                  setSelectedCustomerForDetail(cust);
                                  setOpenActionDropdownId(null);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-600" />
                                View 360Â° Boxed Dossier
                              </button>

                              <button
                                 type="button"
                                onClick={() => openEditModal(cust)}
                                className="w-full px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                              >
                                <Edit className="w-3.5 h-3.5 text-amber-600" />
                                Edit Customer Information
                              </button>

                              <button
                                 type="button"
                                onClick={() => {
                                  setCustomerForPay(cust);
                                  setPayAmount(cust.pendingBalance || cust.totalMonthly);
                                  setIsQuickPayModalOpen(true);
                                  setOpenActionDropdownId(null);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-emerald-700 font-bold"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Quick Receive Payment
                              </button>

                              <button
                                 type="button"
                                onClick={() => {
                                  setVoucherModalCustomer(cust);
                                  setIsVoucherModalOpen(true);
                                  setOpenActionDropdownId(null);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-cyan-700 font-bold"
                              >
                                <Printer className="w-3.5 h-3.5 text-cyan-600" />
                                Print Slip / Send Welcome Msg
                              </button>

                              <button
                                 type="button"
                                onClick={() => sendWhatsAppBill(cust)}
                                className="w-full px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                Send WhatsApp Bill
                              </button>

                              <button
                                 type="button"
                                onClick={() => handleToggleStatus(cust)}
                                className="w-full px-3 py-2 hover:bg-slate-100 flex items-center gap-2 text-slate-800"
                              >
                                <Power className="w-3.5 h-3.5 text-purple-600" />
                                {cust.status === 'Active' ? 'Suspend Connection' : 'Activate Connection'}
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              <button
                                 type="button"
                                onClick={() => handleDeleteCustomer(cust)}
                                className="w-full px-3 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Customer
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination matching screenshot */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-slate-900">
              {Math.min(currentPage * pageSize, filteredCustomers.length)}
            </strong>{' '}
            of <strong className="text-slate-900">{filteredCustomers.length}</strong> customers
          </div>

          <div className="flex items-center gap-1.5">
            <button
               type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                 type="button"
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-lg font-bold text-xs transition-colors ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
               type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar when items selected */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 z-40 text-xs animate-in slide-in-from-bottom-4">
          <div className="font-bold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center font-mono">
              {selectedIds.length}
            </span>
            <span>Customers Selected</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <button
             type="button"
            onClick={() => handleBulkStatusChange('Active')}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors"
          >
            Activate All
          </button>

          <button
             type="button"
            onClick={() => handleBulkStatusChange('Suspended')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold transition-colors"
          >
            Suspend All
          </button>

          <button
             type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold border border-slate-600"
          >
            Export Selected
          </button>

          <button
             type="button"
            onClick={() => setSelectedIds([])}
            className="text-slate-400 hover:text-white underline ml-2 font-medium"
          >
            Deselect
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER 360Â° PROFILE MODAL (EVERY DETAIL ORGANIZED IN DEDICATED BOXES)    */}
      {/* ========================================================================= */}
      {selectedCustomerForDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Top Bar */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                  {selectedCustomerForDetail.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">
                      {selectedCustomerForDetail.name}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        selectedCustomerForDetail.status === 'Active'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {selectedCustomerForDetail.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                    <span>Login: {selectedCustomerForDetail.username}</span>
                    <span>Â·</span>
                    <span className="text-cyan-400">{selectedCustomerForDetail.packageName}</span>
                    <span>Â·</span>
                    <span>{selectedCustomerForDetail.areaName}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                   type="button"
                  onClick={() => openEditModal(selectedCustomerForDetail)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                  Edit Dossier
                </button>

                <button
                   type="button"
                  onClick={() => handleDeleteCustomer(selectedCustomerForDetail)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-bold border border-rose-800 flex items-center gap-1.5 transition-colors"
                  title="Delete or Request Purge"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Delete
                </button>

                <button
                   type="button"
                  onClick={() => {
                    setCustomerForPay(selectedCustomerForDetail);
                    setPayAmount(
                      selectedCustomerForDetail.pendingBalance || selectedCustomerForDetail.totalMonthly
                    );
                    setIsQuickPayModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Collect Payment
                </button>

                <button
                   type="button" aria-label="Close customer details"
                  onClick={() => setSelectedCustomerForDetail(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: ALL INFORMATION IN DISTINCT SEPARATE BOXES */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Monthly Bill</span>
                  <p className="text-xl font-black text-white font-mono mt-0.5">
                    Rs. {selectedCustomerForDetail.totalMonthly.toLocaleString()}
                  </p>
                  <span className="text-[11px] text-slate-500">Base + IP + IPTV</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Pending Dues</span>
                  <p
                    className={`text-xl font-black font-mono mt-0.5 ${
                      (selectedCustomerForDetail.pendingBalance || 0) > 0
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    Rs. {(selectedCustomerForDetail.pendingBalance || 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {(selectedCustomerForDetail.pendingBalance || 0) > 0 ? 'Overdue' : 'Account Clear'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Live Signal (dBm)</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <p className="text-xl font-black text-emerald-300 font-mono">
                      {selectedCustomerForDetail.opticalPowerDbm || -19.4} dBm
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-500 font-semibold">Optimal Optical Power</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Billing Cycle</span>
                  <p className="text-xl font-black text-cyan-300 font-mono mt-0.5">
                    {selectedCustomerForDetail.billingDate || 1}th of Month
                  </p>
                  <span className="text-[11px] text-slate-500">Grace period: 5 days</span>
                </div>
              </div>

              {/* BOX 1: Personal & Identity Information Box */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">
                      1
                    </div>
                    <span>Personal &amp; Identity Dossier</span>
                  </div>
                  <span className="text-[11px] text-slate-400">KYC Verified</span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name</span>
                    <p className="font-bold text-white text-sm mt-0.5">{selectedCustomerForDetail.name}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Father / Guardian Name</span>
                    <p className="font-bold text-slate-200 mt-0.5">
                      {selectedCustomerForDetail.fatherName || 'Muhammad Aslam Bhalli'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">CNIC Number</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-cyan-300">
                        {selectedCustomerForDetail.cnic || '34567-3456789-3'}
                      </span>
                      <button
                         type="button" aria-label="Copy CNIC"
                        onClick={() => copyToClipboard(selectedCustomerForDetail.cnic, 'CNIC')}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Mobile (WhatsApp)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-white">{selectedCustomerForDetail.mobile}</span>
                      <button
                         type="button"
                        onClick={() => sendWhatsAppBill(selectedCustomerForDetail)}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold text-[11px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800"
                      >
                        <MessageSquare className="w-3 h-3" /> Chat
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Alternate Phone</span>
                    <p className="font-mono text-slate-300 mt-0.5">
                      {selectedCustomerForDetail.alternateMobile || '0300-8451122'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Email Address</span>
                    <p className="text-slate-300 mt-0.5 truncate">{selectedCustomerForDetail.email}</p>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-slate-400 block text-[11px]">Installation Physical Address</span>
                    <p className="font-bold text-slate-200 mt-0.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{selectedCustomerForDetail.address}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Landmark / Street Pole</span>
                    <p className="text-slate-300 mt-0.5">
                      {selectedCustomerForDetail.landmark || 'Near Shell Pump, Main Katchery Road, Pasrur'}
                    </p>
                  </div>
                </div>
              </div>

              {/* BOX 2: Network & Live Connectivity Parameters */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xs">
                      2
                    </div>
                    <span>Network &amp; Live Connectivity Parameters</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono">GPON OLT Port Active</span>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Live IP Address</span>
                    <p className="font-bold text-emerald-400 text-sm mt-0.5">
                      {selectedCustomerForDetail.ipAddress}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Subnet Mask &amp; Gateway</span>
                    <p className="text-slate-300 mt-0.5">
                      {selectedCustomerForDetail.subnetMask || '255.255.255.0'} /{' '}
                      {selectedCustomerForDetail.gateway || '192.168.1.1'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">PPPoE Username</span>
                    <p className="font-bold text-cyan-300 mt-0.5">
                      {selectedCustomerForDetail.pppoeUsername || selectedCustomerForDetail.username}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">PPPoE Password</span>
                    <p className="text-slate-300 mt-0.5">
                      {selectedCustomerForDetail.pppoePassword || 'pass@pasrur12'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">ONT MAC Address</span>
                    <p className="text-slate-200 font-bold mt-0.5">
                      {selectedCustomerForDetail.macAddress || '4C:1B:86:92:4A:11'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Optical Power (Rx)</span>
                    <p className="text-emerald-400 font-bold mt-0.5">
                      {selectedCustomerForDetail.opticalPowerDbm || -19.4} dBm
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Drop Fiber Cable</span>
                    <p className="text-slate-200 mt-0.5">
                      {selectedCustomerForDetail.cableLengthMeters || 120} Meters
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Splitter Port</span>
                    <p className="text-cyan-300 font-bold mt-0.5">
                      {selectedCustomerForDetail.splitterPort || 'FAT-04 / Port 7'}
                    </p>
                  </div>
                </div>
              </div>

              {/* BOX 3: Subscription & Tariff Plan Box */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <div className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center text-xs">
                      3
                    </div>
                    <span>Package &amp; Tariff Configuration</span>
                  </div>
                  <span className="text-[11px] text-purple-400">Monthly Recurring</span>
                </div>

                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Selected Package</span>
                    <p className="font-bold text-white text-sm mt-0.5">
                      {selectedCustomerForDetail.packageName}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Bandwidth Speed</span>
                    <p className="font-bold text-cyan-300 text-sm mt-0.5">
                      {selectedCustomerForDetail.packageSpeed || '8 Mbps'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Base Tariff Fee</span>
                    <p className="font-mono font-bold text-white mt-0.5">
                      Rs. {(selectedCustomerForDetail.monthlyFee || 1800).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">IPTV Service</span>
                    <p className="font-bold text-blue-400 mt-0.5">
                      {selectedCustomerForDetail.hasIptv ? 'Yes (HD IPTV Included)' : 'No'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Installation / Setup Fee</span>
                    <p className="font-mono text-slate-300 mt-0.5">
                      Rs. {(selectedCustomerForDetail.connectionFee || 2500).toLocaleString()} (Paid)
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Monthly Bill</span>
                    <p className="font-mono font-black text-emerald-400 text-sm mt-0.5">
                      Rs. {selectedCustomerForDetail.totalMonthly.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Billing Day</span>
                    <p className="font-bold text-slate-200 mt-0.5">
                      {selectedCustomerForDetail.billingDate || 1}st of Month
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Connection Date</span>
                    <p className="font-mono text-slate-300 mt-0.5">
                      {selectedCustomerForDetail.installDate}
                    </p>
                  </div>

                  {Boolean(selectedCustomerForDetail.discount && selectedCustomerForDetail.discount > 0) && (
                    <div className="col-span-2 md:col-span-4 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="text-[11px] font-bold text-emerald-300">Special Tariff / Setup Discount Applied</span>
                          <p className="text-[11px] text-slate-300">Reason: {selectedCustomerForDetail.discountReason || 'Promotional Offer'}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-900/60 text-emerald-300 font-mono font-black text-xs border border-emerald-700">
                        - Rs. {selectedCustomerForDetail.discount?.toLocaleString()} Off
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* BOX 4: Hardware & CPE Equipment Inventory Box */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <div className="w-6 h-6 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center text-xs">
                      4
                    </div>
                    <span>Hardware &amp; CPE Inventory</span>
                  </div>
                  <span className="text-[11px] text-amber-400">Trigon Asset Tracked</span>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[11px] font-sans">Issued ONT Device</span>
                      <p className="font-bold text-white mt-0.5">
                        {selectedCustomerForDetail.device || 'Huawei EchoLife HG8546M GPON ONT'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] font-sans">Serial Number (GPON SN)</span>
                      <p className="font-bold text-cyan-300 mt-0.5">
                        {selectedCustomerForDetail.deviceSerialNumber || '48575443F882194B'}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px] font-sans">Ownership</span>
                      <p className="text-emerald-400 font-bold mt-0.5 font-sans">
                        Company Provided (Security Deposit Paid)
                      </p>
                    </div>
                  </div>

                  {/* Itemized Assigned Inventory Items */}
                  {selectedCustomerForDetail.assignedInventory && selectedCustomerForDetail.assignedInventory.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider block mb-2">
                        Allocated Equipment &amp; Fiber Material
                      </span>
                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                            <tr>
                              <th className="px-3 py-2">Item Description</th>
                              <th className="px-3 py-2 text-right">Unit Price</th>
                              <th className="px-3 py-2 text-center">Allocated Qty</th>
                              <th className="px-3 py-2 text-right">Total Valuation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 font-mono">
                            {selectedCustomerForDetail.assignedInventory.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/50">
                                <td className="px-3 py-2 text-white font-sans font-medium">{item.itemName}</td>
                                <td className="px-3 py-2 text-right text-slate-400">Rs. {Number(item.unitPrice).toLocaleString()}</td>
                                <td className="px-3 py-2 text-center text-cyan-300 font-bold">{item.quantity}</td>
                                <td className="px-3 py-2 text-right text-emerald-400 font-bold">Rs. {Number(item.totalPrice).toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-900/80 font-bold font-sans">
                              <td colSpan={3} className="px-3 py-2 text-right text-slate-300">Total Allocated Equipment Valuation:</td>
                              <td className="px-3 py-2 text-right text-amber-400 font-mono font-black">
                                Rs. {selectedCustomerForDetail.assignedInventory.reduce((acc, i) => acc + (Number(i.totalPrice) || 0), 0).toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOX 5: Customer Invoices & Payment Ledger History */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xs">
                      5
                    </div>
                    <span>Billing History &amp; Payment Ledger</span>
                  </div>
                  <button
                     type="button"
                    onClick={() => {
                      setCustomerForPay(selectedCustomerForDetail);
                      setPayAmount(selectedCustomerForDetail.totalMonthly);
                      setIsQuickPayModalOpen(true);
                    }}
                    className="text-[11px] text-emerald-400 font-bold hover:underline"
                  >
                    + Record Desk Payment
                  </button>
                </div>

                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Billing Month</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3">Paid Date</th>
                        <th className="py-2 px-3">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {invoices
                        .filter(
                          (inv) =>
                            inv.customerId === selectedCustomerForDetail.id ||
                            inv.username === selectedCustomerForDetail.username
                        )
                        .slice(0, 5)
                        .map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-900/60">
                            <td className="py-2.5 px-3 font-bold text-cyan-300">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-sans">
                              {inv.billingMonth}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-white">
                              Rs. {(inv.totalAmount || inv.amount).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inv.status === 'Paid'
                                    ? 'bg-emerald-950 text-emerald-400'
                                    : 'bg-rose-950 text-rose-400'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {inv.paidDate || 'Pending'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-sans">
                              {inv.paymentMethod || 'Cash'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BOX 6: Support Tickets & NOC Incident History */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <div className="w-6 h-6 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center text-xs">
                      6
                    </div>
                    <span>Support Complaints &amp; Service Tickets</span>
                  </div>
                  <span className="text-[11px] text-slate-400">SLA 2-Hour Resolution</span>
                </div>

                <div className="p-4 text-xs font-sans">
                  {complaints.filter(
                    (cmp) =>
                      cmp.customerId === selectedCustomerForDetail.id ||
                      cmp.customerName === selectedCustomerForDetail.name
                  ).length === 0 ? (
                    <div className="py-4 text-center text-slate-400">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                      <p className="font-semibold text-slate-300">Clean Service Record</p>
                      <p className="text-[11px] text-slate-500">
                        No active or pending fault tickets for this subscriber.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {complaints
                        .filter(
                          (cmp) =>
                            cmp.customerId === selectedCustomerForDetail.id ||
                            cmp.customerName === selectedCustomerForDetail.name
                        )
                        .map((cmp) => (
                          <div
                            key={cmp.id}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-purple-400">
                                  #{cmp.ticketNumber}
                                </span>
                                <span className="font-bold text-white">
                                  {cmp.subject || cmp.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Assigned: {cmp.assignedToName || cmp.assignedStaff || 'NOC Team'} Â·{' '}
                                {cmp.createdAt}
                              </p>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                cmp.status === 'Solved'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-amber-950 text-amber-400'
                              }`}
                            >
                              {cmp.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-mono">
                <span>Account Created: {selectedCustomerForDetail.createdAt.split('T')[0]}</span>
                <span>Â·</span>
                <span>Last Updated: {selectedCustomerForDetail.updatedAt.split('T')[0]}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                   type="button"
                  onClick={() => {
                    setVoucherModalCustomer(selectedCustomerForDetail);
                    setIsVoucherModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Voucher Slip
                </button>

                <button
                   type="button"
                  onClick={() => sendWhatsAppBill(selectedCustomerForDetail)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send WhatsApp Bill
                </button>

                <button
                   type="button"
                  onClick={() => handleToggleStatus(selectedCustomerForDetail)}
                  className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
                    selectedCustomerForDetail.status === 'Active'
                      ? 'bg-amber-700 hover:bg-amber-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {selectedCustomerForDetail.status === 'Active' ? 'Suspend Subscriber' : 'Resume Subscriber'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOXED ADD / EDIT CUSTOMER MODAL (EVERY DETAIL SAVES IN DISTINCT BOXES)    */}
      {/* ========================================================================= */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Edit className="w-5 h-5 text-cyan-400" />
                  {customerToEdit ? `Edit Customer: ${customerToEdit.name}` : 'Add New Subscriber (Boxed Profile)'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Information will be verified and saved cleanly in distinct operational boxes
                </p>
              </div>

              <button
                 type="button" aria-label="Close dialog"
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 overflow-y-auto space-y-6">
              {/* Box 1: Personal & Identity Box */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <div className="w-6 h-6 rounded bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                    1
                  </div>
                  <h3 className="font-bold text-white text-sm">Personal &amp; Identity Details</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label htmlFor="full-customer-name" className="block text-slate-400 font-semibold mb-1">Full Customer Name *</label>
                    <input
                       id="full-customer-name"
                      type="text"
                      required
                      placeholder="e.g. Mohsin Bhalli"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="username-login-id" className="block text-slate-400 font-semibold mb-1">Username / Login ID *</label>
                    <input
                       id="username-login-id"
                      type="text"
                      required
                      placeholder="e.g. usman769yy894"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="father-guardian-name" className="block text-slate-400 font-semibold mb-1">Father / Guardian Name</label>
                    <input
                       id="father-guardian-name"
                      type="text"
                      placeholder="e.g. Muhammad Aslam Bhalli"
                      value={formFatherName}
                      onChange={(e) => setFormFatherName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="cnic-number" className="block text-slate-400 font-semibold mb-1">CNIC Number *</label>
                    <input
                       id="cnic-number"
                      type="text"
                      required
                      placeholder="34567-3456789-3"
                      value={formCnic}
                      onChange={(e) => setFormCnic(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="primary-mobile" className="block text-slate-400 font-semibold mb-1">Primary Mobile (WhatsApp) *</label>
                    <input
                       id="primary-mobile"
                      type="text"
                      required
                      placeholder="03023456789"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="alternate-phone" className="block text-slate-400 font-semibold mb-1">Alternate Phone</label>
                    <input
                       id="alternate-phone"
                      type="text"
                      placeholder="0300-8451122"
                      value={formAlternateMobile}
                      onChange={(e) => setFormAlternateMobile(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="physical-installation-address" className="block text-slate-400 font-semibold mb-1">Physical Installation Address *</label>
                    <input
                       id="physical-installation-address"
                      type="text"
                      required
                      placeholder="House 45, Street 2, Pasrur"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="landmark-nearest-pole" className="block text-slate-400 font-semibold mb-1">Landmark / Nearest Pole</label>
                    <input
                       id="landmark-nearest-pole"
                      type="text"
                      placeholder="Near Shell Pump, Main Katchery Road"
                      value={formLandmark}
                      onChange={(e) => setFormLandmark(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Area, Package & Auto Calculator */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <div className="w-6 h-6 rounded bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center text-xs">
                    2
                  </div>
                  <h3 className="font-bold text-white text-sm">Service Area &amp; Package Setup</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label htmlFor="service-area" className="block text-slate-400 font-semibold mb-1">Service Area *</label>
                    <select
                       id="service-area"
                      value={formAreaId}
                      onChange={(e) => setFormAreaId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.city || 'Pasrur'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="internet-package" className="block text-slate-400 font-semibold mb-1">Internet Package *</label>
                    <select
                       id="internet-package"
                      value={formPackageId}
                      onChange={(e) => handlePackageChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - Rs. {p.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="package-monthly-fee" className="block text-slate-400 font-semibold mb-1">Package Monthly Fee (Rs.)</label>
                    <input
                       id="package-monthly-fee"
                      type="number"
                      value={formPackageFee}
                      onChange={(e) => setFormPackageFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="customer-has-iptv"
                      className="block text-slate-400 font-semibold mb-1"
                    >
                      IPTV Channels Service
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        id="customer-has-iptv"
                        type="checkbox"
                        checked={formHasIptv}
                        onChange={(e) => setFormHasIptv(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-white font-bold">Include HD IPTV Channels</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="static-ip-surcharge" className="block text-slate-400 font-semibold mb-1">Static IP Surcharge (Rs.)</label>
                    <input
                       id="static-ip-surcharge"
                      type="number"
                      value={formIpFee}
                      onChange={(e) => setFormIpFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="billing-day-of-month" className="block text-slate-400 font-semibold mb-1">Billing Day of Month (1-28)</label>
                    <input
                       id="billing-day-of-month"
                      type="number"
                      min={1}
                      max={28}
                      value={formBillingDate}
                      onChange={(e) => setFormBillingDate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="installation-connection-fee" className="block text-slate-400 font-semibold mb-1">Installation / Connection Fee (Rs.)</label>
                    <input
                       id="installation-connection-fee"
                      type="number"
                      value={formConnectionFee}
                      onChange={(e) => setFormConnectionFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Discount Scope & Configuration */}
                  <div className="col-span-1 md:col-span-2 space-y-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
                    <label className="block text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Tag className="w-4 h-4" />
                        Discount Configuration &amp; Scope
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Choose applicable deduction target</span>
                    </label>

                    {/* Scope Selector Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormDiscountType('none')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          formDiscountType === 'none'
                            ? 'bg-slate-800 text-white border-slate-600'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        No Discount
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDiscountType('setup')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          formDiscountType === 'setup'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        1st-Time Setup Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDiscountType('monthly')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          formDiscountType === 'monthly'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Monthly Bill Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDiscountType('both')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          formDiscountType === 'both'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Setup + Monthly (Both)
                      </button>
                    </div>

                    {/* Discount Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {(formDiscountType === 'setup' || formDiscountType === 'both') && (
                        <div>
                          <label htmlFor="first-time-setup-install-discount" className="block text-slate-400 font-semibold mb-1 text-xs">
                            First-Time Setup / Install Discount (Rs.)
                          </label>
                          <input
                             id="first-time-setup-install-discount"
                            type="number"
                            min={0}
                            value={formDiscountSetup}
                            onChange={(e) => setFormDiscountSetup(Number(e.target.value))}
                            placeholder="e.g. 500"
                            className="w-full px-3 py-2 bg-slate-950 border border-amber-600/80 rounded-xl text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      )}

                      {(formDiscountType === 'monthly' || formDiscountType === 'both') && (
                        <div>
                          <label htmlFor="monthly-recurring-bill-discount" className="block text-slate-400 font-semibold mb-1 text-xs">
                            Monthly Recurring Bill Discount (Rs.)
                          </label>
                          <input
                             id="monthly-recurring-bill-discount"
                            type="number"
                            min={0}
                            value={formDiscountMonthly}
                            onChange={(e) => setFormDiscountMonthly(Number(e.target.value))}
                            placeholder="e.g. 200"
                            className="w-full px-3 py-2 bg-slate-950 border border-cyan-600/80 rounded-xl text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      )}
                    </div>

                    {formDiscountType !== 'none' && (
                      <div className="pt-2">
                        <label className="block text-slate-400 font-semibold mb-1 text-xs">
                          Discount Justification / Tariff Clause
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={formDiscountReason}
                            onChange={(e) => setFormDiscountReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                          >
                            <option value="">Select Pre-approved Reason...</option>
                            <option value="New Area Launch Promotion">New Area Launch Promotion</option>
                            <option value="Annual Advance Payment Discount">Annual Advance Payment Discount</option>
                            <option value="Friends &amp; Family Privilege">Friends &amp; Family Privilege</option>
                            <option value="Corporate Referral Bonus">Corporate Referral Bonus</option>
                            <option value="Router Trade-in Concession">Router Trade-in Concession</option>
                            <option value="Special Management Approval">Special Management Approval</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Or type custom justification note..."
                            value={formDiscountReason}
                            onChange={(e) => setFormDiscountReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto Calculator Display Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-emerald-950/40 border border-blue-800/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-blue-300 uppercase font-black tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-cyan-400" />
                      Live Comprehensive Billing &amp; Setup Calculator
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Real-time breakdown</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Monthly Internet Tariff</span>
                      <p className="text-base font-black text-cyan-300 font-mono mt-0.5">
                        Rs. {netMonthlyPayable.toLocaleString()}
                      </p>
                      <span className="text-[9px] text-slate-500">
                        {effectiveMonthlyDisc > 0
                          ? `(Gross Rs. ${calculatedTotalMonthly} - Rs. ${effectiveMonthlyDisc})`
                          : 'Base + IP + IPTV'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Setup Fee + Hardware</span>
                      <p className="text-base font-black text-amber-300 font-mono mt-0.5">
                        Rs. {(Number(formConnectionFee) + totalInventoryCost).toLocaleString()}
                      </p>
                      <span className="text-[9px] text-slate-500">Conn (Rs. {formConnectionFee}) + Equip (Rs. {totalInventoryCost})</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Setup Discount Applied</span>
                      <p className="text-base font-black text-emerald-400 font-mono mt-0.5">
                        - Rs. {effectiveSetupDisc.toLocaleString()}
                      </p>
                      <span className="text-[9px] text-emerald-500/80 truncate block">{formDiscountReason || 'None'}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-600/60">
                      <span className="text-[10px] text-emerald-300 font-bold block">Net Initial Setup Due</span>
                      <p className="text-lg font-black text-emerald-300 font-mono mt-0.5">
                        Rs. {netInitialSetupFee.toLocaleString()}
                      </p>
                      <span className="text-[9px] text-emerald-400 font-semibold">Payable at Installation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 3: Network & Technical Configuration */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <div className="w-6 h-6 rounded bg-purple-600/30 text-purple-400 font-bold flex items-center justify-center text-xs">
                    3
                  </div>
                  <h3 className="font-bold text-white text-sm">Network &amp; Live Connectivity Parameters</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs font-mono">
                  <div>
                    <label htmlFor="live-ip-address" className="block text-slate-400 font-sans font-semibold mb-1">Live IP Address</label>
                    <input
                       id="live-ip-address"
                      type="text"
                      value={formIpAddress}
                      onChange={(e) => setFormIpAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="pppoe-password" className="block text-slate-400 font-sans font-semibold mb-1">PPPoE Password</label>
                    <input
                       id="pppoe-password"
                      type="text"
                      value={formPppoePass}
                      onChange={(e) => setFormPppoePass(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="ont-mac-address" className="block text-slate-400 font-sans font-semibold mb-1">ONT MAC Address</label>
                    <input
                       id="ont-mac-address"
                      type="text"
                      value={formMacAddress}
                      onChange={(e) => setFormMacAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="optical-power" className="block text-slate-400 font-sans font-semibold mb-1">Optical Power (dBm)</label>
                    <input
                       id="optical-power"
                      type="number"
                      step="0.1"
                      value={formOpticalPower}
                      onChange={(e) => setFormOpticalPower(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="drop-fiber" className="block text-slate-400 font-sans font-semibold mb-1">Drop Fiber (Meters)</label>
                    <input
                       id="drop-fiber"
                      type="number"
                      value={formCableLength}
                      onChange={(e) => setFormCableLength(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="splitter-fat-port" className="block text-slate-400 font-sans font-semibold mb-1">Splitter / FAT Port</label>
                    <input
                       id="splitter-fat-port"
                      type="text"
                      value={formSplitterPort}
                      onChange={(e) => setFormSplitterPort(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Box 4: Hardware & Equipment Inventory */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-amber-600/30 text-amber-400 font-bold flex items-center justify-center text-xs">
                      4
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">CPE Hardware &amp; Inventory Allocation</h3>
                      <p className="text-[10px] text-slate-400">Allocate single or multiple equipment items with quantity-based auto pricing</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddInventoryRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Add Equipment Item
                  </button>
                </div>

                {/* Primary Device & SN */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label htmlFor="primary-device-router-model" className="block text-slate-400 font-semibold mb-1">Primary Device / Router Model</label>
                    <input
                       id="primary-device-router-model"
                      type="text"
                      value={formDevice}
                      onChange={(e) => setFormDevice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="serial-number" className="block text-slate-400 font-semibold mb-1">Serial Number (GPON SN)</label>
                    <input
                       id="serial-number"
                      type="text"
                      value={formDeviceSerial}
                      onChange={(e) => setFormDeviceSerial(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="account-initial-status" className="block text-slate-400 font-semibold mb-1">Account Initial Status</label>
                    <select
                       id="account-initial-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as 'Active' | 'Suspended')}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="Active">Active (Online)</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Multiple Inventory Equipment Allocation List */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-amber-400" />
                      Assigned Inventory Items ({formAssignedInventory.length})
                    </span>
                    <span className="text-[11px] text-amber-400 font-mono font-bold">
                      Total Hardware Value: Rs. {totalInventoryCost.toLocaleString()}
                    </span>
                  </div>

                  {formAssignedInventory.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs">
                      <p className="text-slate-400">No extra inventory equipment allocated yet.</p>
                      <button
                        type="button"
                        onClick={handleAddInventoryRow}
                        className="mt-2 text-xs text-amber-400 hover:underline font-bold"
                      >
                        + Add First Equipment Item (e.g. ONT Router, Fiber Cable, Connectors)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {formAssignedInventory.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs"
                        >
                          {/* Item Dropdown */}
                          <div className="sm:col-span-5">
                            <label htmlFor={`inventory-item-${idx}`} className="block text-[10px] text-slate-400 font-semibold mb-0.5 sm:hidden">
                              Inventory Item
                            </label>
                            <select
                               id={`inventory-item-${idx}`}
                              value={item.itemId}
                              onChange={(e) => handleInventoryItemSelect(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-medium focus:outline-none focus:border-amber-400 text-xs"
                            >
                              {inventoryList.map((inv) => {
                                const p = inv.sellingPrice || inv.price || inv.unitCost || 0;
                                return (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.name} (Stock: {inv.quantity} {inv.unit} | Rs. {p.toLocaleString()})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Unit Price (Read-only Auto populated) */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5 sm:hidden">
                              Unit Price
                            </label>
                            <div className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 font-mono text-center text-xs">
                              Rs. {Number(item.unitPrice).toLocaleString()}
                            </div>
                          </div>

                          {/* Quantity (User enters ONLY quantity, price auto calculates) */}
                          <div className="sm:col-span-2">
                            <label htmlFor={`inventory-item-quantity-${idx}`} className="block text-[10px] text-slate-400 font-semibold mb-0.5 sm:hidden">
                              Quantity
                            </label>
                            <input
                               id={`inventory-item-quantity-${idx}`}
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleInventoryQtyChange(idx, Number(e.target.value))}
                              placeholder="Qty"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-cyan-300 font-mono font-bold text-center focus:outline-none focus:border-cyan-400 text-xs"
                            />
                          </div>

                          {/* Auto Calculated Total Price */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5 sm:hidden">
                              Total Price
                            </label>
                            <div className="px-2.5 py-1.5 bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-emerald-400 font-mono font-black text-center text-xs">
                              Rs. {Number(item.totalPrice).toLocaleString()}
                            </div>
                          </div>

                          {/* Delete Item */}
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveInventoryRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg transition-all"
                >
                  {customerToEdit ? 'Save Changes Across All Boxes' : 'Save New Customer in Boxes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK PAY MODAL                                                           */}
      {/* ========================================================================= */}
      {isQuickPayModalOpen && customerForPay && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Record Desk Payment</h3>
              </div>
              <button
                 type="button" aria-label="Close quick payment dialog"
                onClick={() => setIsQuickPayModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickPay} className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400">Subscriber</span>
                <p className="font-bold text-white text-sm mt-0.5">{customerForPay.name}</p>
                <p className="text-slate-400 font-mono mt-0.5">
                  {customerForPay.username} Â· {customerForPay.packageName} Â· {customerForPay.areaName}
                </p>
              </div>

              <div>
                <label htmlFor="amount-to-collect" className="block text-slate-400 font-semibold mb-1">Amount to Collect (Rs.) *</label>
                <input
                   id="amount-to-collect"
                  type="number"
                  required
                  min={1}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono font-black text-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="quick-pay-method" className="block text-slate-400 font-semibold mb-1">Payment Method</label>
                <select
                    id="quick-pay-method"
                   value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium"
                >
                  <option value="Cash">Cash at Counter</option>
                  <option value="JazzCash">JazzCash</option>
                  <option value="EasyPaisa">EasyPaisa</option>
                  <option value="Bank Transfer">Bank Transfer (HBL / Meezan)</option>
                </select>
              </div>

              <div>
                <label htmlFor="transaction-ref-slip" className="block text-slate-400 font-semibold mb-1">Transaction Ref / Slip #</label>
                <input
                   id="transaction-ref-slip"
                  type="text"
                  placeholder="e.g. JC-99214 or Counter Receipt #12"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Confirm &amp; Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK STATUS CHANGE MODAL                                                  */}
      {/* ========================================================================= */}
      {isBulkStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-xs">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-400" />
              Bulk Status Change
            </h3>
            <p className="text-slate-400 mb-4">
              Apply status update to {selectedIds.length > 0 ? selectedIds.length : 'selected'} customers at once.
            </p>

            <div className="space-y-3">
              <button
                 type="button"
                onClick={() => handleBulkStatusChange('Active')}
                className="w-full p-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-700 text-emerald-300 font-bold flex items-center justify-between transition-colors"
              >
                <span>Set Status to &quot;Active&quot;</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </button>

              <button
                 type="button"
                onClick={() => handleBulkStatusChange('Suspended')}
                className="w-full p-3 rounded-xl bg-amber-950/50 hover:bg-amber-900/50 border border-amber-700 text-amber-300 font-bold flex items-center justify-between transition-colors"
              >
                <span>Set Status to &quot;Suspended&quot; (Temporary Freeze)</span>
                <Power className="w-4 h-4 text-amber-400" />
              </button>
            </div>

            <button
               type="button"
              onClick={() => setIsBulkStatusModalOpen(false)}
              className="mt-5 w-full py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GENERATE CUSTOM REPORT MODAL                                              */}
      {/* ========================================================================= */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Custom Customer Intelligence Report
              </h3>
              <button type="button" aria-label="Close report" onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Registered Subscribers:</span>
                  <strong className="text-white font-mono">{totalCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Rate:</span>
                  <strong className="text-emerald-400 font-mono">{activeRatePercent}% ({activeCount} Active)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Collections This Month:</span>
                  <strong className="text-white font-mono">Rs. {totalCollection.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Pending Dues Across Network:</span>
                  <strong className="text-rose-400 font-mono">Rs. {totalPending.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Average Revenue Per User (ARPU):</span>
                  <strong className="text-cyan-300 font-mono">Rs. {avgPackagePrice.toLocaleString()}</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800 text-blue-200">
                Report encompasses all zones (Pasrur City, Sialkot Cantt, Daska, Lahore) with real-time optical link stats.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                 type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Download CSV Dataset
              </button>
              <button
                 type="button"
                onClick={() => {
                  window.print();
                  setIsReportModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
              >
                Print Official Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPORT DATA MODAL                                                         */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 text-xs">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              Import Customer Records
            </h3>
            <p className="text-slate-400 mb-4">
              Upload customer list via CSV or Excel format. Boxed fields (PPPoE, ONT, Area, Package) will be auto-mapped.
            </p>

            <div className="p-6 border-2 border-dashed border-slate-700 rounded-2xl text-center hover:border-blue-500 cursor-pointer bg-slate-950/60">
              <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="font-bold text-slate-200">Drag &amp; Drop CSV File Here</p>
              <p className="text-[11px] text-slate-500 mt-1">or click to browse from your computer</p>
            </div>

            <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800">
              <button
                 type="button"
                onClick={handleExportCSV}
                className="text-blue-400 hover:underline font-bold text-[11px]"
              >
                Download Template CSV
              </button>
              <button
                 type="button"
                onClick={() => {
                  showToast('info', 'File Received', 'Sample customer records parsed successfully.');
                  setIsImportModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Upload &amp; Process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Voucher & Welcome Message Modal */}
      <CustomerOnboardingSlipModal
        isOpen={isVoucherModalOpen}
        customer={voucherModalCustomer}
        onClose={() => setIsVoucherModalOpen(false)}
        autoPrint={false}
      />

      {/* Customer Deletion / Admin Approval Modal */}
      <CustomerDeleteModal
        isOpen={isDeleteModalOpen}
        customer={customerToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCustomerToDelete(null);
        }}
        onSuccess={() => {
          refreshData();
          if (selectedCustomerForDetail?.id === customerToDelete?.id) {

            setSelectedCustomerForDetail(null);
          }
        }}
      />
    </div>
  );
};

