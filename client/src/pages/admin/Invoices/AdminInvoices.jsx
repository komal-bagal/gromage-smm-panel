/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaPrint,
  FaEye,
  FaBuilding,
  FaFileInvoiceDollar,
  FaReceipt,
  FaPercent,
  FaSync,
  FaExclamationTriangle,
  FaClock,
  FaUndo,
  FaCheckCircle,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

// Helper: Convert numeric amount into Indian Rupees in Words
function numberToWordsINR(num) {
  if (isNaN(num) || num === 0) return "Zero Rupees Only";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  function convertChunk(n) {
    if (n < 20) return a[n];
    if (n < 100) return `${b[Math.floor(n / 10)]} ${a[n % 10]}`.trim();
    if (n < 1000)
      return `${a[Math.floor(n / 100)]} Hundred ${convertChunk(n % 100)}`.trim();
    return "";
  }

  let words = "";
  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  if (crore > 0) words += `${convertChunk(crore)} Crore `;
  if (lakh > 0) words += `${convertChunk(lakh)} Lakh `;
  if (thousand > 0) words += `${convertChunk(thousand)} Thousand `;
  if (remainder > 0) words += `${convertChunk(remainder)} `;

  words = words.trim() || "Zero";
  words += " Rupees";

  if (decimalPart > 0) {
    words += ` and ${convertChunk(decimalPart)} Paise`;
  }
  return `${words} Only`;
}

function AdminInvoices() {
  const { addToast } = useToast();

  // Primary Data State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filter State
  const [search, setSearch] = useState("");
  const [taxTypeFilter, setTaxTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");

  // GST Settings State
  const [settings, setSettings] = useState({
    businessName: "Gromage Digital Media Private Limited",
    gstin: "27ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    state: "Maharashtra (27)",
    hsnCode: "998313",
    gstRate: 18,
    address: "Unit 402, Pinnacle Tech Park, Baner Road, Pune, Maharashtra 411045, India",
    invoicePrefix: "GRO-INV-2026-",
    email: "billing@gromage.com",
    phone: "+91 98765 43210",
  });
  const [initialSettings, setInitialSettings] = useState(null);
  const [settingsErrors, setSettingsErrors] = useState({});
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // View Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const [invData, gstData] = await Promise.all([
          adminService.getInvoices(),
          adminService.getGstSettings ? adminService.getGstSettings() : Promise.resolve(null),
        ]);

        setInvoices(Array.isArray(invData) ? invData : []);

        if (gstData && typeof gstData === "object") {
          setSettings((prev) => ({ ...prev, ...gstData }));
          setInitialSettings(gstData);
        }

        if (isManualRefresh) {
          addToast("GST invoices and tax records refreshed", "success");
        }
      } catch (err) {
        console.error("Failed to load invoice records:", err);
        setFetchError("Failed to load invoice and tax records. Please try again.");
        addToast("Failed to load invoice records", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------
  // Dynamic KPI Metrics (Calculated safely from active dataset)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const totalCount = invoices.length;

    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalGrand = 0;

    invoices.forEach((inv) => {
      const taxable = Number(inv.taxable) || 0;
      const cgst = Number(inv.cgst) || 0;
      const sgst = Number(inv.sgst) || 0;
      const igst = Number(inv.igst) || 0;
      const total = Number(inv.total) || taxable + cgst + sgst + igst;

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      totalGrand += total;
    });

    const totalGst = totalCgst + totalSgst + totalIgst;

    return {
      totalCount,
      totalTaxable,
      totalGst,
      totalGrand,
      totalCgst,
      totalSgst,
      totalIgst,
    };
  }, [invoices]);

  // -------------------------------------------------------------
  // Filtered Invoices
  // -------------------------------------------------------------
  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();

    return invoices.filter((i) => {
      // Search matches
      const matchesSearch =
        !q ||
        (i.id && i.id.toLowerCase().includes(q)) ||
        (i.number && i.number.toLowerCase().includes(q)) ||
        (i.user && i.user.toLowerCase().includes(q)) ||
        (i.userEmail && i.userEmail.toLowerCase().includes(q)) ||
        (i.txnId && i.txnId.toLowerCase().includes(q)) ||
        (i.state && i.state.toLowerCase().includes(q));

      // Tax Type filter
      let matchesTaxType = true;
      if (taxTypeFilter !== "all") {
        const igstVal = Number(i.igst) || 0;
        if (taxTypeFilter === "intra") {
          matchesTaxType = igstVal === 0;
        } else if (taxTypeFilter === "inter") {
          matchesTaxType = igstVal > 0;
        }
      }

      // State filter
      const matchesState =
        stateFilter === "all" ||
        (i.state && i.state.toLowerCase().includes(stateFilter.toLowerCase()));

      return matchesSearch && matchesTaxType && matchesState;
    });
  }, [invoices, search, taxTypeFilter, stateFilter]);

  const hasActiveFilters =
    search.trim() !== "" || taxTypeFilter !== "all" || stateFilter !== "all";

  const handleResetFilters = () => {
    setSearch("");
    setTaxTypeFilter("all");
    setStateFilter("all");
  };

  // -------------------------------------------------------------
  // GST Settings Form Validation & Save
  // -------------------------------------------------------------
  const validateSettings = () => {
    const errors = {};
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    if (!settings.businessName.trim()) {
      errors.businessName = "Registered business name is required";
    }

    const trimmedGstin = settings.gstin.trim().toUpperCase();
    if (!trimmedGstin) {
      errors.gstin = "GSTIN is required";
    } else if (trimmedGstin.length !== 15 || !gstinRegex.test(trimmedGstin)) {
      errors.gstin = "Enter valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)";
    }

    const trimmedPan = settings.pan.trim().toUpperCase();
    if (!trimmedPan) {
      errors.pan = "PAN number is required";
    } else if (trimmedPan.length !== 10 || !panRegex.test(trimmedPan)) {
      errors.pan = "Enter valid 10-character PAN (e.g. ABCDE1234F)";
    }

    if (!settings.state.trim()) {
      errors.state = "State / Place of Supply is required";
    }

    const numRate = Number(settings.gstRate);
    if (isNaN(numRate) || numRate < 0 || numRate > 28) {
      errors.gstRate = "GST rate must be between 0% and 28%";
    }

    if (!settings.address.trim()) {
      errors.address = "Business address is required";
    }

    setSettingsErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();

    if (!validateSettings()) {
      addToast("Please resolve validation errors in GST configuration", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (adminService.updateGstSettings) {
        await adminService.updateGstSettings(settings);
      }
      setInitialSettings({ ...settings });
      addToast("GST configuration & business tax details updated successfully", "success");
      setSettingsModalOpen(false);
    } catch (err) {
      console.error("Failed to save GST configuration:", err);
      addToast("Failed to save GST configuration", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const isSettingsDirty = useMemo(() => {
    if (!initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  const handleDiscardSettings = () => {
    if (initialSettings) {
      setSettings({ ...initialSettings });
    }
    setSettingsErrors({});
  };

  // -------------------------------------------------------------
  // Invoice Viewing & Printing
  // -------------------------------------------------------------
  const handleViewInvoice = (inv) => {
    setSelectedInvoice(inv);
    setViewModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // Table Columns Definition
  // -------------------------------------------------------------
  const columns = [
    {
      header: "Invoice #",
      accessor: "id",
      className: "font-mono font-bold text-xs text-blue-600 whitespace-nowrap",
      render: (row) => (
        <button
          onClick={() => handleViewInvoice(row)}
          className="hover:underline font-mono font-bold text-xs text-blue-600 text-left flex items-center gap-1.5"
          title="Click to view full Tax Invoice"
        >
          <span>{row.number || row.id}</span>
        </button>
      ),
    },
    {
      header: "Customer",
      accessor: "user",
      render: (row) => (
        <div className="max-w-[150px] truncate">
          <p className="font-semibold text-xs text-gray-900 truncate">{row.user}</p>
          {row.userEmail && (
            <p className="text-[10px] text-gray-400 truncate">{row.userEmail}</p>
          )}
        </div>
      ),
    },
    {
      header: "Linked Txn",
      accessor: "txnId",
      render: (row) => (
        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
          {row.txnId}
        </span>
      ),
    },
    {
      header: "Taxable Value",
      accessor: "taxable",
      render: (row) => (
        <span className="font-mono text-xs text-gray-800 font-medium">
          ₹
          {Number(row.taxable || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      header: "CGST / SGST",
      accessor: "cgst",
      render: (row) => {
        const cgst = Number(row.cgst) || 0;
        const sgst = Number(row.sgst) || 0;
        if (cgst === 0 && sgst === 0) {
          return <span className="text-gray-400 text-xs">—</span>;
        }
        return (
          <span className="font-mono text-xs text-gray-700">
            ₹{cgst.toFixed(2)} / ₹{sgst.toFixed(2)}
          </span>
        );
      },
    },
    {
      header: "IGST",
      accessor: "igst",
      render: (row) => {
        const igst = Number(row.igst) || 0;
        if (igst === 0) {
          return <span className="text-gray-400 text-xs">—</span>;
        }
        return (
          <span className="font-mono text-xs text-purple-700 font-semibold">
            ₹{igst.toFixed(2)}
          </span>
        );
      },
    },
    {
      header: "Total (INR)",
      accessor: "total",
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-gray-900">
          ₹
          {Number(row.total || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      header: "Date",
      accessor: "date",
      render: (row) => (
        <div className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap">
          <FaClock className="text-[10px] text-gray-400 shrink-0" />
          <span>{row.date}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Button
            size="xs"
            variant="outline"
            onClick={() => handleViewInvoice(row)}
            icon={<FaEye className="text-blue-600 text-xs" />}
          >
            View Invoice
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setSelectedInvoice(row);
              setTimeout(() => window.print(), 100);
            }}
            icon={<FaPrint className="text-gray-600 text-xs" />}
            title="Print Tax Invoice"
          />
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* ------------------------------------------------------------- */}
      {/* Page Header */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <FaFileInvoiceDollar className="text-lg" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                GST Invoices & Taxation
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Compliant Indian GST tax invoice generation, statutory records, GSTIN settings, and tax reports
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<FaSync className={refreshing ? "animate-spin" : ""} />}
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FaBuilding />}
            onClick={() => setSettingsModalOpen(true)}
          >
            GST Configuration
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Loading Skeleton */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      ) : fetchError ? (
        /* ------------------------------------------------------------- */
        /* Error State */
        /* ------------------------------------------------------------- */
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3 my-6">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl">
            <FaExclamationTriangle />
          </div>
          <h3 className="text-base font-bold text-rose-900">Failed to Load Invoices</h3>
          <p className="text-xs text-rose-600 max-w-md mx-auto">{fetchError}</p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => loadData(false)}
            icon={<FaSync />}
          >
            Retry Loading
          </Button>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------------- */}
          {/* Summary KPI Cards */}
          {/* ------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Invoices */}
            <div
              onClick={() => {
                setTaxTypeFilter("all");
                setStateFilter("all");
              }}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Total Tax Invoices
                </p>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                  <FaReceipt />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mt-2">
                {metrics.totalCount}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Rule 46 compliant records</p>
            </div>

            {/* Total Taxable Value */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Taxable Turnover
                </p>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                  <FaFileInvoiceDollar />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mt-2">
                ₹{metrics.totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Net taxable service base
              </p>
            </div>

            {/* Total GST Collected */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Total GST Collected
                </p>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
                  <FaPercent />
                </div>
              </div>
              <h3 className="text-2xl font-black text-purple-600 mt-2">
                ₹{metrics.totalGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                CGST: ₹{metrics.totalCgst.toFixed(0)} · SGST: ₹{metrics.totalSgst.toFixed(0)} · IGST: ₹{metrics.totalIgst.toFixed(0)}
              </p>
            </div>

            {/* Gross Total Value */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Gross Invoiced Total
                </p>
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center text-sm">
                  <FaBuilding />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mt-2">
                ₹{metrics.totalGrand.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">Total revenue including taxes</p>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Main Invoices DataTable */}
          {/* ------------------------------------------------------------- */}
          <DataTable
            columns={columns}
            data={filteredInvoices}
            isLoading={loading}
            searchable={true}
            searchPlaceholder="Search by Invoice #, Customer, Transaction ID..."
            searchValue={search}
            onSearch={setSearch}
            emptyTitle="No Tax Invoices Found"
            emptySubtitle="No tax invoices match your active search or filter criteria."
            filters={
              <div className="flex flex-wrap items-center gap-2">
                {/* Tax Type Filter */}
                <select
                  value={taxTypeFilter}
                  onChange={(e) => setTaxTypeFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Tax Types</option>
                  <option value="intra">Intra-State (CGST + SGST)</option>
                  <option value="inter">Inter-State (IGST)</option>
                </select>

                {/* State Filter */}
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Places of Supply</option>
                  <option value="Maharashtra">Maharashtra (27)</option>
                  <option value="Delhi">Delhi (07)</option>
                  <option value="Karnataka">Karnataka (29)</option>
                </select>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleResetFilters}
                    icon={<FaUndo className="text-[10px]" />}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            }
          />
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal 1: GST Configuration Modal */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => !isSaving && setSettingsModalOpen(false)}
        title="GST & Statutory Tax Configuration"
        subtitle="Configure legal business credentials, GSTIN, PAN, and tax percentages printed on customer invoices"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {isSettingsDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardSettings}
                  disabled={isSaving}
                >
                  Discard Changes
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSettings}
                isLoading={isSaving}
                icon={<FaCheckCircle />}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveSettings} className="space-y-5">
          {/* Section A: Registered Business Details */}
          <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <FaBuilding className="text-blue-600" />
              <span>Registered Business Entity Details</span>
            </h4>

            <div>
              <Input
                label="Registered Legal Business Name"
                required
                placeholder="e.g. Gromage Digital Media Private Limited"
                value={settings.businessName}
                onChange={(e) => {
                  setSettings({ ...settings, businessName: e.target.value });
                  if (settingsErrors.businessName)
                    setSettingsErrors({ ...settingsErrors, businessName: null });
                }}
                error={settingsErrors.businessName}
              />
            </div>

            <div>
              <Input
                label="Registered Business Address"
                required
                placeholder="Unit / Floor, Building, Street, City, State, PIN"
                value={settings.address}
                onChange={(e) => {
                  setSettings({ ...settings, address: e.target.value });
                  if (settingsErrors.address)
                    setSettingsErrors({ ...settingsErrors, address: null });
                }}
                error={settingsErrors.address}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Billing Support Email"
                type="email"
                placeholder="billing@gromage.com"
                value={settings.email || ""}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />

              <Input
                label="Billing Contact Phone"
                placeholder="+91 98765 43210"
                value={settings.phone || ""}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Section B: Tax & Statutory Compliance */}
          <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <FaPercent className="text-purple-600" />
              <span>Tax & Statutory Identifiers</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="GSTIN (15 Alphanumeric Characters)"
                required
                placeholder="27ABCDE1234F1Z5"
                maxLength={15}
                value={settings.gstin}
                onChange={(e) => {
                  setSettings({ ...settings, gstin: e.target.value.toUpperCase() });
                  if (settingsErrors.gstin)
                    setSettingsErrors({ ...settingsErrors, gstin: null });
                }}
                error={settingsErrors.gstin}
              />

              <Input
                label="PAN Number (10 Alphanumeric Characters)"
                required
                placeholder="ABCDE1234F"
                maxLength={10}
                value={settings.pan}
                onChange={(e) => {
                  setSettings({ ...settings, pan: e.target.value.toUpperCase() });
                  if (settingsErrors.pan) setSettingsErrors({ ...settingsErrors, pan: null });
                }}
                error={settingsErrors.pan}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="State / Place of Supply"
                  required
                  placeholder="e.g. Maharashtra (27)"
                  value={settings.state}
                  onChange={(e) => {
                    setSettings({ ...settings, state: e.target.value });
                    if (settingsErrors.state)
                      setSettingsErrors({ ...settingsErrors, state: null });
                  }}
                  error={settingsErrors.state}
                />
              </div>

              <div>
                <Input
                  label="Service SAC / HSN Code"
                  placeholder="998313"
                  value={settings.hsnCode}
                  onChange={(e) => setSettings({ ...settings, hsnCode: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Standard GST Rate (%)"
                  type="number"
                  step="0.5"
                  min="0"
                  max="28"
                  placeholder="18"
                  value={settings.gstRate}
                  onChange={(e) => {
                    setSettings({ ...settings, gstRate: Number(e.target.value) });
                    if (settingsErrors.gstRate)
                      setSettingsErrors({ ...settingsErrors, gstRate: null });
                  }}
                  error={settingsErrors.gstRate}
                />
              </div>
            </div>
          </div>

          {/* Section C: Billing & Invoice Preferences */}
          <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <FaReceipt className="text-emerald-600" />
              <span>Invoice Serial Numbering</span>
            </h4>

            <div>
              <Input
                label="Invoice Number Prefix"
                placeholder="GRO-INV-2026-"
                value={settings.invoicePrefix || ""}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Professional Tax Invoice View & Print Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedInvoice && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Tax Invoice #${selectedInvoice.number || selectedInvoice.id}`}
          size="lg"
          footer={
            <div className="w-full flex justify-between items-center">
              <Button
                size="sm"
                variant="outline"
                icon={<FaPrint />}
                onClick={handlePrint}
              >
                Print Invoice
              </Button>
              <Button size="sm" variant="primary" onClick={() => setViewModalOpen(false)}>
                Close Window
              </Button>
            </div>
          }
        >
          <div className="print-container border border-gray-300 rounded-xl p-6 bg-white text-xs text-gray-800 space-y-5 shadow-xs">
            {/* Invoice Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start pb-4 border-b border-gray-300 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Supplier / Service Provider
                </span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                  {settings.businessName}
                </h2>
                <p className="text-gray-600 text-xs leading-relaxed max-w-sm">
                  {settings.address}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 pt-1 font-mono">
                  <span>
                    <strong>GSTIN:</strong> {settings.gstin}
                  </span>
                  <span>
                    <strong>PAN:</strong> {settings.pan}
                  </span>
                  <span>
                    <strong>State Code:</strong> {settings.state}
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 space-y-1">
                <span className="inline-block text-[11px] font-bold uppercase bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200">
                  ORIGINAL TAX INVOICE
                </span>
                <p className="font-mono font-black text-base text-gray-900 mt-1">
                  #{selectedInvoice.number || selectedInvoice.id}
                </p>
                <p className="text-gray-500 text-xs">Date: {selectedInvoice.date}</p>
                <p className="text-[11px] text-gray-400 font-mono">
                  Txn ID: {selectedInvoice.txnId}
                </p>
              </div>
            </div>

            {/* Billed To / Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-200 bg-gray-50/60 p-3 rounded-lg">
              <div>
                <span className="text-gray-400 font-bold block uppercase text-[10px] tracking-wider">
                  Billed To (Recipient):
                </span>
                <p className="font-bold text-gray-900 text-sm mt-0.5">
                  {selectedInvoice.user}
                </p>
                {selectedInvoice.userEmail && (
                  <p className="text-gray-600 text-xs">{selectedInvoice.userEmail}</p>
                )}
                {selectedInvoice.userId && (
                  <p className="text-gray-400 text-[11px] font-mono">
                    User ID: {selectedInvoice.userId}
                  </p>
                )}
              </div>
              <div className="sm:text-right">
                <span className="text-gray-400 font-bold block uppercase text-[10px] tracking-wider">
                  Place of Supply:
                </span>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">
                  {selectedInvoice.state || settings.state}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  GST Treatment:{" "}
                  {Number(selectedInvoice.igst || 0) > 0
                    ? "Inter-State Supply (IGST)"
                    : "Intra-State Supply (CGST+SGST)"}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300 text-gray-700 font-bold text-[11px]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description of Services</th>
                    <th className="py-2.5 px-3 text-center">SAC / HSN</th>
                    <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 text-right">CGST (₹)</th>
                    <th className="py-2.5 px-3 text-right">SGST (₹)</th>
                    <th className="py-2.5 px-3 text-right">IGST (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="py-3 px-3 font-mono text-gray-500">1</td>
                    <td className="py-3 px-3 font-medium text-gray-900">
                      {selectedInvoice.description || "SMM Wallet Recharge / Digital Services"}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-gray-600">
                      {selectedInvoice.hsnCode || settings.hsnCode}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      ₹{Number(selectedInvoice.taxable || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-gray-600">
                      {Number(selectedInvoice.cgst || 0) > 0
                        ? `₹${Number(selectedInvoice.cgst).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-gray-600">
                      {Number(selectedInvoice.sgst || 0) > 0
                        ? `₹${Number(selectedInvoice.sgst).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-purple-700 font-semibold">
                      {Number(selectedInvoice.igst || 0) > 0
                        ? `₹${Number(selectedInvoice.igst).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                      ₹{Number(selectedInvoice.total || 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Calculations and Amount in Words Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 items-start">
              {/* Words and Terms */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Total Amount in Words:
                  </span>
                  <p className="font-semibold text-gray-800 text-xs italic mt-0.5">
                    {numberToWordsINR(Number(selectedInvoice.total || 0))}
                  </p>
                </div>

                <div className="pt-2 text-[11px] text-gray-500 space-y-0.5">
                  <p>1. Computer generated tax invoice issued under Rule 46 of CGST Rules, 2017.</p>
                  <p>2. Electronic supply of digital services / wallet credits.</p>
                </div>
              </div>

              {/* Tax Summary Table */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5 text-right font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-sans">Taxable Subtotal:</span>
                  <span className="font-bold text-gray-900">
                    ₹{Number(selectedInvoice.taxable || 0).toFixed(2)}
                  </span>
                </div>

                {Number(selectedInvoice.cgst || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-sans">
                      CGST ({(selectedInvoice.gstRate || settings.gstRate) / 2}%):
                    </span>
                    <span className="text-gray-700">
                      ₹{Number(selectedInvoice.cgst || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                {Number(selectedInvoice.sgst || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-sans">
                      SGST ({(selectedInvoice.gstRate || settings.gstRate) / 2}%):
                    </span>
                    <span className="text-gray-700">
                      ₹{Number(selectedInvoice.sgst || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                {Number(selectedInvoice.igst || 0) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-sans">
                      IGST ({selectedInvoice.gstRate || settings.gstRate}%):
                    </span>
                    <span className="text-purple-700 font-bold">
                      ₹{Number(selectedInvoice.igst || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-sans">
                    Total GST ({selectedInvoice.gstRate || settings.gstRate}%):
                  </span>
                  <span className="font-semibold text-gray-800">
                    ₹
                    {(
                      Number(selectedInvoice.cgst || 0) +
                      Number(selectedInvoice.sgst || 0) +
                      Number(selectedInvoice.igst || 0)
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-black text-gray-900">
                  <span className="font-sans">Grand Total:</span>
                  <span className="text-base text-emerald-700">
                    ₹{Number(selectedInvoice.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default AdminInvoices;
