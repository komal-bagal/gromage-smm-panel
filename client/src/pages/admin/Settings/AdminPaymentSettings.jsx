/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaCreditCard,
  FaCheckCircle,
  FaGlobe,
  FaFlask,
  FaEdit,
  FaBan,
  FaCheck,
  FaShieldAlt,
  FaSync,
  FaSearch,
  FaExclamationTriangle,
  FaSave,
  FaLock,
  FaRupeeSign,
  FaInfoCircle,
  FaTimes,
  FaEye,
  FaEyeSlash,
  FaFilter,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

// Format currency in Indian Rupees (INR)
function formatINR(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(num);
}

// Initial form state
const EMPTY_FORM = {
  isEnabled: true,
  testMode: false,
  feePercent: 0,
  minDeposit: 50,
  maxDeposit: 50000,
  keyId: "",
  newSecret: "",
};

function AdminPaymentSettings() {
  const { addToast } = useToast();

  // Primary gateway data state
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'disabled'
  const [envFilter, setEnvFilter] = useState("all"); // 'all' | 'live' | 'sandbox'

  // Row-level action states
  const [togglingId, setTogglingId] = useState(null);
  const [disableConfirmModal, setDisableConfirmModal] = useState({
    isOpen: false,
    gateway: null,
  });

  // Edit / Configuration modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeGateway, setActiveGateway] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [showSecretInput, setShowSecretInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // Fetch gateways from service layer
  const fetchGateways = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const data = await adminService.getPaymentGateways();
        setGateways(Array.isArray(data) ? data : []);
        if (isManualRefresh) {
          addToast("Payment gateways refreshed successfully", "success");
        }
      } catch (err) {
        const errorMsg =
          err?.message || "Failed to load payment gateway settings. Please try again.";
        setFetchError(errorMsg);
        addToast(errorMsg, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  // Derived Summary Metrics (Dynamic calculation)
  const summaryMetrics = useMemo(() => {
    const total = gateways.length;
    const active = gateways.filter((g) => g.isEnabled).length;
    const live = gateways.filter((g) => !g.testMode).length;
    const sandbox = gateways.filter((g) => g.testMode).length;
    const activePercent = total > 0 ? Math.round((active / total) * 100) : 0;

    return {
      total,
      active,
      live,
      sandbox,
      activePercent,
    };
  }, [gateways]);

  // Filtered and Searched Gateways
  const filteredGateways = useMemo(() => {
    return gateways.filter((gw) => {
      // Status filter
      if (statusFilter === "active" && !gw.isEnabled) return false;
      if (statusFilter === "disabled" && gw.isEnabled) return false;

      // Environment filter
      if (envFilter === "live" && gw.testMode) return false;
      if (envFilter === "sandbox" && !gw.testMode) return false;

      // Search term matching (Name, ID, Code, Type, KeyID - NEVER secrets)
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchesName = gw.name ? gw.name.toLowerCase().includes(term) : false;
        const matchesId = gw.id ? gw.id.toLowerCase().includes(term) : false;
        const matchesCode = gw.code ? gw.code.toLowerCase().includes(term) : false;
        const matchesType = gw.type ? gw.type.toLowerCase().includes(term) : false;
        const matchesKey = gw.keyId ? gw.keyId.toLowerCase().includes(term) : false;

        if (!matchesName && !matchesId && !matchesCode && !matchesType && !matchesKey) {
          return false;
        }
      }

      return true;
    });
  }, [gateways, statusFilter, envFilter, searchTerm]);

  // Open Configure Modal
  const handleEdit = (gw) => {
    setActiveGateway(gw);
    setFormData({
      isEnabled: Boolean(gw.isEnabled),
      testMode: Boolean(gw.testMode),
      feePercent: gw.feePercent !== undefined ? gw.feePercent : 0,
      minDeposit: gw.minDeposit !== undefined ? gw.minDeposit : 50,
      maxDeposit: gw.maxDeposit !== undefined ? gw.maxDeposit : 50000,
      keyId: gw.keyId || "",
      newSecret: "",
    });
    setFormErrors({});
    setShowSecretInput(false);
    setModalOpen(true);
  };

  // Check if modal form is dirty (unsaved changes)
  const isFormDirty = useMemo(() => {
    if (!activeGateway || !modalOpen) return false;
    const isFeeDirty =
      Number(formData.feePercent) !== Number(activeGateway.feePercent || 0);
    const isMinDirty =
      Number(formData.minDeposit) !== Number(activeGateway.minDeposit || 0);
    const isMaxDirty =
      Number(formData.maxDeposit) !== Number(activeGateway.maxDeposit || 0);
    const isKeyDirty = (formData.keyId || "").trim() !== (activeGateway.keyId || "").trim();
    const isStatusDirty = Boolean(formData.isEnabled) !== Boolean(activeGateway.isEnabled);
    const isModeDirty = Boolean(formData.testMode) !== Boolean(activeGateway.testMode);
    const isSecretDirty = formData.newSecret.trim().length > 0;

    return (
      isFeeDirty ||
      isMinDirty ||
      isMaxDirty ||
      isKeyDirty ||
      isStatusDirty ||
      isModeDirty ||
      isSecretDirty
    );
  }, [formData, activeGateway, modalOpen]);

  // Request to close modal with unsaved changes guard
  const requestCloseModal = () => {
    if (isFormDirty) {
      setConfirmCloseOpen(true);
    } else {
      setModalOpen(false);
    }
  };

  const forceCloseModal = () => {
    setConfirmCloseOpen(false);
    setModalOpen(false);
    setActiveGateway(null);
    setFormErrors({});
  };

  // Form Validation Logic
  const validateForm = () => {
    const errors = {};

    const feeNum = Number(formData.feePercent);
    if (isNaN(feeNum) || feeNum < 0) {
      errors.feePercent = "Gateway fee must be a valid non-negative number";
    } else if (feeNum > 100) {
      errors.feePercent = "Gateway fee percentage cannot exceed 100%";
    }

    const minNum = Number(formData.minDeposit);
    if (isNaN(minNum) || minNum <= 0) {
      errors.minDeposit = "Minimum deposit must be greater than ₹0";
    }

    const maxNum = Number(formData.maxDeposit);
    if (isNaN(maxNum) || maxNum <= 0) {
      errors.maxDeposit = "Maximum deposit must be greater than ₹0";
    } else if (!isNaN(minNum) && maxNum <= minNum) {
      errors.maxDeposit = `Maximum deposit (₹${formatINR(maxNum)}) must be greater than minimum deposit (₹${formatINR(minNum)})`;
    }

    if (!formData.keyId || !formData.keyId.trim()) {
      errors.keyId = "Merchant Key ID / App ID is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Modal Form Data
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      addToast("Please correct the validation errors in the form", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        isEnabled: formData.isEnabled,
        testMode: formData.testMode,
        feePercent: Number(formData.feePercent),
        minDeposit: Number(formData.minDeposit),
        maxDeposit: Number(formData.maxDeposit),
        keyId: formData.keyId.trim(),
      };

      // Only send newSecret if administrator provided a non-empty string
      if (formData.newSecret && formData.newSecret.trim()) {
        payload.newSecret = formData.newSecret.trim();
      }

      const response = await adminService.updatePaymentGateway(activeGateway.id, payload);

      if (response && response.success === false) {
        throw new Error(response.message || "Failed to update payment gateway");
      }

      // Update local state with the latest saved values
      setGateways((prev) =>
        prev.map((g) =>
          g.id === activeGateway.id
            ? {
                ...g,
                ...payload,
                secretMasked: "••••••••••••••••",
              }
            : g
        )
      );

      addToast(`Payment gateway '${activeGateway.name}' settings saved`, "success");
      setModalOpen(false);
      setActiveGateway(null);
      setFormErrors({});
    } catch (err) {
      const msg = err?.message || "Failed to update payment gateway configuration";
      addToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Initiate toggle (Enable / Disable)
  const handleToggleClick = (gw) => {
    if (gw.isEnabled) {
      // When disabling an active gateway, show confirmation prompt
      setDisableConfirmModal({
        isOpen: true,
        gateway: gw,
      });
    } else {
      // When enabling a disabled gateway, toggle directly
      executeToggle(gw, true);
    }
  };

  // Execute Toggle action
  const executeToggle = async (gw, nextState) => {
    setTogglingId(gw.id);
    try {
      const response = await adminService.updatePaymentGateway(gw.id, {
        isEnabled: nextState,
      });

      if (response && response.success === false) {
        throw new Error(response.message || "Failed to update status");
      }

      setGateways((prev) =>
        prev.map((g) => (g.id === gw.id ? { ...g, isEnabled: nextState } : g))
      );

      addToast(
        `Payment gateway '${gw.name}' ${nextState ? "Enabled" : "Disabled"} successfully`,
        "success"
      );
    } catch (err) {
      const msg = err?.message || "Failed to toggle gateway status";
      addToast(msg, "error");
    } finally {
      setTogglingId(null);
      setDisableConfirmModal({ isOpen: false, gateway: null });
    }
  };

  // Reset all filters and search
  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setEnvFilter("all");
  };

  // Table Columns Definition
  const columns = [
    {
      header: "Payment Method / Provider",
      accessor: "name",
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-base shrink-0 shadow-xs">
            <FaCreditCard className="text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-900">{row.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {row.id}
              </span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
              {row.type || "Digital Payment Gateway"}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Environment",
      accessor: "testMode",
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
            row.testMode
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {row.testMode ? (
            <>
              <FaFlask className="text-[11px]" /> Sandbox (Test)
            </>
          ) : (
            <>
              <FaGlobe className="text-[11px]" /> Live (Production)
            </>
          )}
        </span>
      ),
    },
    {
      header: "Gateway Fee",
      accessor: "feePercent",
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-gray-900">{row.feePercent}%</span>
          {Number(row.feePercent) === 0 && (
            <span className="ml-1 text-[10px] text-emerald-600 font-medium">
              (Zero Fee)
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Deposit Limits (Min / Max)",
      accessor: "minDeposit",
      render: (row) => (
        <div className="text-xs font-mono text-gray-800 space-y-0.5">
          <div>
            <span className="text-gray-400 text-[10px] font-sans mr-1">Min:</span>
            ₹{formatINR(row.minDeposit)}
          </div>
          <div>
            <span className="text-gray-400 text-[10px] font-sans mr-1">Max:</span>
            ₹{formatINR(row.maxDeposit)}
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "isEnabled",
      render: (row) => (
        <Badge
          status={row.isEnabled ? "Active" : "Disabled"}
          size="sm"
        />
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (row) => {
        const isThisToggling = togglingId === row.id;

        return (
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => handleEdit(row)}
              icon={<FaEdit className="text-blue-600" />}
              aria-label={`Configure ${row.name}`}
            >
              Configure
            </Button>
            <Button
              size="xs"
              variant={row.isEnabled ? "outline" : "success"}
              onClick={() => handleToggleClick(row)}
              isLoading={isThisToggling}
              disabled={isThisToggling}
              icon={
                row.isEnabled ? (
                  <FaBan className="text-rose-600" />
                ) : (
                  <FaCheck className="text-white" />
                )
              }
              aria-label={row.isEnabled ? `Disable ${row.name}` : `Enable ${row.name}`}
            >
              {row.isEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Payment Gateway Configuration
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              CMS & Gateways
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Configure merchant credentials, deposit limits, transaction fees, and sandbox environments
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchGateways(true)}
            isLoading={refreshing}
            disabled={loading || refreshing}
            icon={<FaSync className={refreshing ? "animate-spin text-blue-600" : "text-gray-600"} />}
          >
            Refresh Gateways
          </Button>
        </div>
      </div>

      {/* Security Policy Alert Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 rounded-xl mb-6 flex items-start sm:items-center gap-3.5 text-xs text-blue-950 shadow-xs">
        <div className="p-2 rounded-lg bg-blue-100/80 text-blue-700 shrink-0 mt-0.5 sm:mt-0">
          <FaShieldAlt className="text-lg" />
        </div>
        <div className="flex-1 leading-relaxed">
          <strong className="font-semibold text-blue-900">Strict Credential Security Policy:</strong>{" "}
          Merchant API secrets and private tokens are encrypted server-side and never returned to the browser in cleartext. Masked keys (`••••••••`) indicate saved credentials. Entering a new value securely replaces the secret upon saving.
        </div>
      </div>

      {/* Error / Retry Banner */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6 flex items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-center gap-2.5">
            <FaExclamationTriangle className="text-rose-600 text-base shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button size="xs" variant="outline" onClick={() => fetchGateways(false)}>
            Retry Loading
          </Button>
        </div>
      )}

      {/* Dynamic Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Gateways */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <FaCreditCard />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Gateways
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-gray-900">
                  {summaryMetrics.total}
                </span>
                <span className="text-[11px] text-gray-400">Providers</span>
              </div>
            )}
          </div>
        </div>

        {/* Active Gateways */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <FaCheckCircle />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Gateways
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-emerald-600">
                  {summaryMetrics.active}
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  ({summaryMetrics.activePercent}% Enabled)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Production Gateways */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
            <FaGlobe />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Live Production
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-indigo-600">
                  {summaryMetrics.live}
                </span>
                <span className="text-[11px] text-gray-400">Live Routes</span>
              </div>
            )}
          </div>
        </div>

        {/* Sandbox / Test Gateways */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
            <FaFlask />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sandbox (Test)
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-amber-600">
                  {summaryMetrics.sandbox}
                </span>
                <span className="text-[11px] text-gray-400">Testing Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by provider name, gateway ID, or key identifier..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Clear search"
            >
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <FaFilter className="text-gray-400 text-[10px]" />
            <span className="font-semibold hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses ({gateways.length})</option>
              <option value="active">Active Only ({summaryMetrics.active})</option>
              <option value="disabled">
                Disabled Only ({summaryMetrics.total - summaryMetrics.active})
              </option>
            </select>
          </div>

          {/* Environment Filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="font-semibold hidden sm:inline">Env:</span>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Environments ({gateways.length})</option>
              <option value="live">Live / Production ({summaryMetrics.live})</option>
              <option value="sandbox">Sandbox / Test ({summaryMetrics.sandbox})</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(searchTerm || statusFilter !== "all" || envFilter !== "all") && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleResetFilters}
              icon={<FaTimes className="text-rose-500" />}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Payment Gateways Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredGateways}
          isLoading={loading}
          searchable={false}
          emptyTitle={
            searchTerm || statusFilter !== "all" || envFilter !== "all"
              ? "No matching payment gateways"
              : "No payment gateways found"
          }
          emptySubtitle={
            searchTerm || statusFilter !== "all" || envFilter !== "all"
              ? "Try adjusting your search keywords or filter criteria."
              : "No payment gateways have been configured in the system."
          }
        />
      </div>

      {/* Edit Gateway Configuration Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={requestCloseModal}
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span>Configure Gateway: {activeGateway?.name}</span>
            {isFormDirty && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                ● Unsaved Changes
              </span>
            )}
          </div>
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              <FaLock className="text-gray-400" />
              <span>Settings are safely stored and API-ready</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={requestCloseModal}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                isLoading={isSaving}
                icon={<FaSave />}
              >
                Save Configuration
              </Button>
            </div>
          </div>
        }
      >
        {activeGateway && (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Modal Info Header Card */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <FaCreditCard />
                </div>
                <div>
                  <div className="font-bold text-gray-900">{activeGateway.name}</div>
                  <div className="text-gray-500 font-mono text-[11px]">
                    ID: {activeGateway.id} • Code: {activeGateway.code}
                  </div>
                </div>
              </div>
              <Badge
                status={formData.isEnabled ? "Active" : "Disabled"}
                size="xs"
              />
            </div>

            {/* SECTION A: Availability & Environment Mode */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <FaGlobe className="text-gray-400" />
                <span>Section A: Gateway Availability & Environment</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Enable for Customers */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                    formData.isEnabled
                      ? "bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, isEnabled: e.target.checked })
                    }
                    className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">
                        Enable for Customers
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          formData.isEnabled
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {formData.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                      Display on customer deposit page for wallet recharges.
                    </p>
                  </div>
                </label>

                {/* Sandbox / Test Mode */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                    formData.testMode
                      ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-400"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.testMode}
                    onChange={(e) =>
                      setFormData({ ...formData, testMode: e.target.checked })
                    }
                    className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">
                        Sandbox / Test Mode
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          formData.testMode
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {formData.testMode ? "Sandbox" : "Live"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                      Route payments to the test sandbox environment.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* SECTION B: Merchant API Credentials */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <FaLock className="text-gray-400" />
                <span>Section B: Merchant API Credentials</span>
              </h3>

              {/* Key ID / App ID */}
              <div>
                <Input
                  label="Key ID / Merchant App ID"
                  placeholder="e.g. rzp_live_xxxxxxxx or CF_APP_xxxxxxxx"
                  value={formData.keyId}
                  onChange={(e) => {
                    setFormData({ ...formData, keyId: e.target.value });
                    if (formErrors.keyId) {
                      setFormErrors({ ...formErrors, keyId: null });
                    }
                  }}
                  error={formErrors.keyId}
                />
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                  <FaInfoCircle className="text-[10px]" />
                  <span>Public merchant identifier provided in your payment provider dashboard.</span>
                </p>
              </div>

              {/* Secret Key / Private Token */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Secret Key / Merchant Private Token
                </label>
                <div className="relative">
                  <input
                    type={showSecretInput ? "text" : "password"}
                    placeholder="Leave blank to keep existing secret, or type new secret to update"
                    value={formData.newSecret}
                    onChange={(e) => setFormData({ ...formData, newSecret: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretInput(!showSecretInput)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    aria-label={showSecretInput ? "Hide Secret" : "Show Secret"}
                  >
                    {showSecretInput ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                  <span className="flex items-center gap-1 text-blue-600">
                    <FaShieldAlt className="text-[10px]" />
                    <span>Existing secret is masked and protected.</span>
                  </span>
                  {formData.newSecret && (
                    <span className="text-amber-600 font-medium">
                      ● New secret entered (will be updated on save)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION C: Deposit Limits & Fee Configuration */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <FaRupeeSign className="text-gray-400" />
                <span>Section C: Deposit Limits & Transaction Fees</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Fee Percent */}
                <div>
                  <Input
                    label="Gateway Surcharge Fee (%)"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0.0"
                    value={formData.feePercent}
                    onChange={(e) => {
                      setFormData({ ...formData, feePercent: e.target.value });
                      if (formErrors.feePercent) {
                        setFormErrors({ ...formErrors, feePercent: null });
                      }
                    }}
                    error={formErrors.feePercent}
                  />
                </div>

                {/* Min Deposit */}
                <div>
                  <Input
                    label="Min Deposit (₹ INR)"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="50"
                    value={formData.minDeposit}
                    onChange={(e) => {
                      setFormData({ ...formData, minDeposit: e.target.value });
                      if (formErrors.minDeposit || formErrors.maxDeposit) {
                        setFormErrors({ ...formErrors, minDeposit: null, maxDeposit: null });
                      }
                    }}
                    error={formErrors.minDeposit}
                  />
                </div>

                {/* Max Deposit */}
                <div>
                  <Input
                    label="Max Deposit (₹ INR)"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="50000"
                    value={formData.maxDeposit}
                    onChange={(e) => {
                      setFormData({ ...formData, maxDeposit: e.target.value });
                      if (formErrors.maxDeposit) {
                        setFormErrors({ ...formErrors, maxDeposit: null });
                      }
                    }}
                    error={formErrors.maxDeposit}
                  />
                </div>
              </div>

              {/* Deposit Range & Surcharge Live Preview Callout */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  formErrors.maxDeposit
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-blue-50/70 border-blue-200 text-blue-900"
                }`}
              >
                <FaInfoCircle className="shrink-0 text-sm" />
                <div className="flex-1">
                  <strong>Deposit Range Summary:</strong> Customers will be permitted to recharge between{" "}
                  <strong className="font-mono">₹{formatINR(formData.minDeposit || 0)}</strong> and{" "}
                  <strong className="font-mono">₹{formatINR(formData.maxDeposit || 0)}</strong> per transaction
                  with a <strong className="font-mono">{formData.feePercent || 0}%</strong> gateway surcharge.
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Discard Unsaved Changes Dialog */}
      <ConfirmDialog
        isOpen={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        onConfirm={forceCloseModal}
        title="Discard Unsaved Changes?"
        message="You have unsaved modifications in this gateway configuration. Are you sure you want to discard your changes?"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        variant="danger"
      />

      {/* Confirm Disable Active Gateway Dialog */}
      <ConfirmDialog
        isOpen={disableConfirmModal.isOpen}
        onClose={() => setDisableConfirmModal({ isOpen: false, gateway: null })}
        onConfirm={() =>
          executeToggle(disableConfirmModal.gateway, false)
        }
        title={`Disable ${disableConfirmModal.gateway?.name}?`}
        message={`Disabling this payment gateway will immediately remove it from customer deposit options on the frontend. Customers will not be able to deposit funds using ${disableConfirmModal.gateway?.name}.`}
        confirmText="Disable Gateway"
        cancelText="Cancel"
        variant="danger"
        isLoading={togglingId === disableConfirmModal.gateway?.id}
      />
    </AdminLayout>
  );
}

export default AdminPaymentSettings;

