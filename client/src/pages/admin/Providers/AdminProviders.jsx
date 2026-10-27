import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaPlus,
  FaEdit,
  FaSync,
  FaCheckCircle,
  FaEye,
  FaEyeSlash,
  FaHistory,
  FaServer,
  FaCheck,
  FaBan,
  FaExternalLinkAlt,
  FaExclamationTriangle,
  FaTimes,
  FaPlug,
  FaShoppingCart,
  FaPercent,
  FaSlidersH,
  FaBolt,
  FaInfoCircle,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
const CURRENCY_OPTIONS = ["USD", "INR", "EUR"];
const MARGIN_TYPES = [
  { value: "percentage", label: "Percentage-based Markup (%)" },
  { value: "fixed", label: "Fixed Amount Markup (Flat Addition)" },
  { value: "hybrid", label: "Hybrid (Percentage + Fixed Markup)" },
];

function AdminProviders() {
  const { addToast } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [activeProvName, setActiveProvName] = useState("");
  const [autoMarginModalOpen, setAutoMarginModalOpen] = useState(false);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: "status", // "status" | "sync_orders" | "sync_services"
    provider: null,
    action: null,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "primary",
  });

  // Form State
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    apiKey: "",
    priority: "Medium",
    currency: "USD",
    autoSync: true,
    autoRefill: false,
    autoMarginEnabled: true,
    autoMarginType: "percentage",
    autoMarginPercent: "20.0",
    autoMarginFixed: "5.0",
    status: "Active",
    description: "",
  });

  // Auto Margin Dedicated Form State
  const [marginForm, setMarginForm] = useState({
    autoMarginEnabled: true,
    autoMarginType: "percentage",
    autoMarginPercent: "20.0",
    autoMarginFixed: "5.0",
    minMargin: "1.0",
  });
  const [marginErrors, setMarginErrors] = useState({});
  const [isSavingMargin, setIsSavingMargin] = useState(false);
  const [simCost, setSimCost] = useState("1.00");

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  /*
   * Fetch providers from mock service layer.
   */
  const fetchProviders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setFetchError(null);

    try {
      const data = await adminService.getProviders();
      setProviders(data || []);
    } catch (err) {
      console.error("Fetch providers error:", err);
      setFetchError("Failed to fetch providers. Please try again.");
      addToast("Failed to fetch providers", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  /*
   * Initial load
   */
  useEffect(() => {
    let cancelled = false;

    const loadInitialProviders = async () => {
      try {
        const data = await adminService.getProviders();
        if (!cancelled) {
          setProviders(data || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Initial providers fetch error:", err);
          setFetchError("Failed to fetch providers.");
          setLoading(false);
        }
      }
    };

    loadInitialProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered providers
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.name?.toLowerCase().includes(term) ||
        p.url?.toLowerCase().includes(term) ||
        p.id?.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [providers, search, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = providers.length;
    const active = providers.filter((p) => p.status === "Active").length;
    const disabled = providers.filter((p) => p.status === "Disabled").length;
    const totalServices = providers.reduce((acc, p) => acc + (p.services || 0), 0);
    return { total, active, disabled, totalServices };
  }, [providers]);

  // Open Add Provider Modal
  // Open Add Provider Modal
  const handleOpenAdd = () => {
    setEditingProvider(null);
    setFormData({
      name: "",
      url: "",
      apiKey: "",
      priority: "Medium",
      currency: "USD",
      autoSync: true,
      autoRefill: false,
      autoMarginEnabled: true,
      autoMarginType: "percentage",
      autoMarginPercent: "20.0",
      autoMarginFixed: "5.0",
      status: "Active",
      description: "",
    });
    setFormErrors({});
    setShowApiKey(false);
    setAddEditModalOpen(true);
  };

  // Open Edit Provider Modal
  const handleOpenEdit = (prov) => {
    setEditingProvider(prov);
    setFormData({
      name: prov.name || "",
      url: prov.url || "",
      apiKey: "",
      priority: prov.priority || "Medium",
      currency: prov.currency || "USD",
      autoSync: prov.autoSync !== undefined ? prov.autoSync : true,
      autoRefill: prov.autoRefill !== undefined ? prov.autoRefill : false,
      autoMarginEnabled: prov.autoMarginEnabled !== undefined ? Boolean(prov.autoMarginEnabled) : true,
      autoMarginType: prov.autoMarginType || "percentage",
      autoMarginPercent: prov.autoMarginPercent !== undefined ? String(prov.autoMarginPercent) : "20.0",
      autoMarginFixed: prov.autoMarginFixed !== undefined ? String(prov.autoMarginFixed) : "5.0",
      status: prov.status || "Active",
      description: prov.description || "",
    });
    setFormErrors({});
    setShowApiKey(false);
    setAddEditModalOpen(true);
  };

  // Open Provider Details View Modal
  const handleViewDetails = (prov) => {
    setSelectedProvider(prov);
    setDetailsModalOpen(true);
  };

  // Open Dedicated Auto Margin Modal
  const handleOpenAutoMargin = (prov) => {
    setSelectedProvider(prov);
    setMarginForm({
      autoMarginEnabled: prov.autoMarginEnabled !== undefined ? Boolean(prov.autoMarginEnabled) : true,
      autoMarginType: prov.autoMarginType || "percentage",
      autoMarginPercent: prov.autoMarginPercent !== undefined ? String(prov.autoMarginPercent) : "20.0",
      autoMarginFixed: prov.autoMarginFixed !== undefined ? String(prov.autoMarginFixed) : "5.0",
      minMargin: prov.minMargin !== undefined ? String(prov.minMargin) : "1.0",
    });
    setMarginErrors({});
    setAutoMarginModalOpen(true);
  };

  // Save Dedicated Auto Margin Configuration
  const handleSaveAutoMargin = async (e) => {
    e.preventDefault();
    const errors = {};
    const numPercent = Number(marginForm.autoMarginPercent);
    const numFixed = Number(marginForm.autoMarginFixed);
    const numMin = Number(marginForm.minMargin);

    if (marginForm.autoMarginEnabled) {
      if (marginForm.autoMarginType === "percentage" || marginForm.autoMarginType === "hybrid") {
        if (
          marginForm.autoMarginPercent === "" ||
          isNaN(numPercent) ||
          numPercent < 0 ||
          numPercent > 500
        ) {
          errors.autoMarginPercent = "Percentage markup must be between 0% and 500%";
        }
      }
      if (marginForm.autoMarginType === "fixed" || marginForm.autoMarginType === "hybrid") {
        if (marginForm.autoMarginFixed === "" || isNaN(numFixed) || numFixed < 0) {
          errors.autoMarginFixed = "Fixed markup must be a positive number";
        }
      }
      if (marginForm.minMargin !== "" && (isNaN(numMin) || numMin < 0)) {
        errors.minMargin = "Minimum margin cannot be negative";
      }
    }

    if (Object.keys(errors).length > 0) {
      setMarginErrors(errors);
      return;
    }

    setIsSavingMargin(true);
    try {
      const payload = {
        autoMarginEnabled: Boolean(marginForm.autoMarginEnabled),
        autoMarginType: marginForm.autoMarginType,
        autoMarginPercent: numPercent || 0,
        autoMarginFixed: numFixed || 0,
        minMargin: numMin || 0,
      };
      const res = await adminService.updateProviderAutoMargin(selectedProvider.id, payload);
      setProviders((prev) =>
        prev.map((p) => (p.id === selectedProvider.id ? { ...p, ...payload } : p))
      );
      if (selectedProvider) {
        setSelectedProvider((prev) => (prev ? { ...prev, ...payload } : null));
      }
      addToast(res.message || "Auto margin rules updated successfully", "success");
      setAutoMarginModalOpen(false);
    } catch (err) {
      console.error("Save auto margin error:", err);
      addToast("Failed to update auto margin settings", "error");
    } finally {
      setIsSavingMargin(false);
    }
  };

  // Save Provider (Add / Edit)
  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name.trim()) errors.name = "Provider name is required";
    if (!formData.url.trim()) {
      errors.url = "API URL endpoint is required";
    } else if (!formData.url.startsWith("http://") && !formData.url.startsWith("https://")) {
      errors.url = "URL must start with http:// or https://";
    }

    if (!editingProvider && !formData.apiKey.trim()) {
      errors.apiKey = "API key / secret token is required for new providers";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProvider) {
        const updatePayload = {
          name: formData.name,
          url: formData.url,
          priority: formData.priority,
          currency: formData.currency,
          autoSync: formData.autoSync,
          autoRefill: formData.autoRefill,
          autoMarginEnabled: Boolean(formData.autoMarginEnabled),
          autoMarginType: formData.autoMarginType,
          autoMarginPercent: Number(formData.autoMarginPercent) || 0,
          autoMarginFixed: Number(formData.autoMarginFixed) || 0,
          status: formData.status,
          description: formData.description,
        };
        const updated = await adminService.updateProvider(editingProvider.id, updatePayload);
        await fetchProviders();
        if (selectedProvider?.id === editingProvider.id) {
          setSelectedProvider((prev) => ({ ...prev, ...updated }));
        }
        addToast("Provider configuration updated successfully", "success");
      } else {
        const created = await adminService.createProvider({
          ...formData,
          autoMarginPercent: Number(formData.autoMarginPercent) || 0,
          autoMarginFixed: Number(formData.autoMarginFixed) || 0,
        });
        await fetchProviders();
        addToast(`Provider ${created.name} added successfully`, "success");
      }
      setAddEditModalOpen(false);
    } catch (err) {
      console.error("Save provider error:", err);
      addToast("Failed to save provider", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test Connection
  const handleTestConnection = async (prov) => {
    const key = `test_${prov.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await adminService.testProviderConnection(prov.id);
      addToast(res.message || "Connection successful! Provider is online.", "success");
    } catch (err) {
      console.error("Test connection error:", err);
      addToast("Provider connection test failed", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Sync Services
  const handleSyncServices = async (prov) => {
    const key = `sync_${prov.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await adminService.syncProviderServices(prov.id);
      addToast(res.message || "Provider services synced successfully", "success");
      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id ? { ...p, lastSync: "Just now" } : p
        )
      );
      if (selectedProvider?.id === prov.id) {
        setSelectedProvider((prev) => (prev ? { ...prev, lastSync: "Just now" } : null));
      }
    } catch (err) {
      console.error("Sync services error:", err);
      addToast("Service catalog sync failed", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Sync Orders Action & Execution
  const handleSyncOrders = (prov) => {
    setConfirmDialog({
      isOpen: true,
      type: "sync_orders",
      provider: prov,
      action: "Sync Orders",
      title: "Sync Orders from Provider",
      message: `Initiate a live batch order status synchronization from ${prov.name}? This will query the upstream provider API for all processing/pending orders and update local order fulfillment states.`,
      confirmText: "Sync Orders",
      variant: "primary",
    });
  };

  const executeSyncOrders = async (prov) => {
    if (!prov) return;
    const key = `sync_orders_${prov.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setIsSubmitting(true);
    try {
      const res = await adminService.syncProviderOrders(prov.id);
      addToast(res.message || "Provider orders synced successfully", "success");
      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id ? { ...p, lastOrderSync: "Just now" } : p
        )
      );
      if (selectedProvider?.id === prov.id) {
        setSelectedProvider((prev) =>
          prev ? { ...prev, lastOrderSync: "Just now" } : null
        );
      }
    } catch (err) {
      console.error("Sync orders error:", err);
      addToast("Order status sync failed", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
      setIsSubmitting(false);
      setConfirmDialog({ isOpen: false, provider: null, action: null });
    }
  };

  // Check / Refresh Balance
  const handleCheckBalance = async (prov) => {
    const key = `balance_${prov.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await adminService.checkProviderBalance(prov.id);
      addToast(res.message || "Balance checked successfully", "success");
      if (res.balance) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === prov.id ? { ...p, balance: res.balance } : p
          )
        );
        if (selectedProvider?.id === prov.id) {
          setSelectedProvider((prev) => (prev ? { ...prev, balance: res.balance } : null));
        }
      }
    } catch (err) {
      console.error("Check balance error:", err);
      addToast("Failed to refresh balance", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // View API Request Logs
  const handleViewLogs = async (prov) => {
    setActiveProvName(prov.name);
    try {
      const logs = await adminService.getProviderLogs(prov.id);
      setSelectedLogs(logs || []);
      setLogsModalOpen(true);
    } catch (err) {
      console.error("Load logs error:", err);
      addToast("Failed to load provider API logs", "error");
    }
  };

  // Toggle Provider Status (Enable / Disable)
  const handleToggleStatus = (prov) => {
    const nextStatus = prov.status === "Active" ? "Disabled" : "Active";
    setConfirmDialog({
      isOpen: true,
      type: "status",
      provider: prov,
      action: nextStatus,
      title: `${nextStatus} Provider`,
      message: `Are you sure you want to mark ${prov.name} as ${nextStatus}? ${
        nextStatus === "Disabled"
          ? "Automated order routing and catalog synchronization will be paused for this provider."
          : "Automated order routing and service sync will resume."
      }`,
      confirmText: nextStatus,
      variant: nextStatus === "Disabled" ? "danger" : "success",
    });
  };

  const executeStatusChange = async () => {
    const { provider, action } = confirmDialog;
    if (!provider || !action) return;

    setIsSubmitting(true);
    try {
      await adminService.updateProviderStatus(provider.id, action);
      await fetchProviders();
      if (selectedProvider?.id === provider.id) {
        setSelectedProvider((prev) => (prev ? { ...prev, status: action } : null));
      }
      addToast(`Provider ${provider.name} is now ${action.toLowerCase()}`, "success");
    } catch (err) {
      console.error("Status update error:", err);
      addToast("Failed to update provider status", "error");
    } finally {
      setIsSubmitting(false);
      setConfirmDialog({ isOpen: false, provider: null, action: null });
    }
  };

  // Universal Confirmation Action Handler
  const handleConfirmAction = () => {
    if (confirmDialog.type === "sync_orders") {
      executeSyncOrders(confirmDialog.provider);
    } else {
      executeStatusChange();
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";

  // Table Columns Definition
  const columns = [
    {
      header: "Provider Details",
      accessor: "name",
      render: (row) => (
        <div>
          <button
            type="button"
            onClick={() => handleViewDetails(row)}
            className="font-bold text-gray-900 text-sm hover:text-blue-600 transition cursor-pointer text-left block"
          >
            {row.name}
          </button>
          <p className="text-xs text-blue-600 font-mono mt-0.5 truncate max-w-[280px]" title={row.url}>
            {row.url}
          </p>
          {row.description && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[280px]" title={row.description}>
              {row.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {row.autoMarginEnabled ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FaPercent className="text-[8px]" />
                {row.autoMarginType === "percentage"
                  ? `+${row.autoMarginPercent ?? 20}% Margin`
                  : row.autoMarginType === "fixed"
                  ? `+${row.currency === "INR" ? "₹" : "$"}${row.autoMarginFixed ?? 5} Margin`
                  : `+${row.autoMarginPercent ?? 20}% + ${row.currency === "INR" ? "₹" : "$"}${row.autoMarginFixed ?? 5}`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                Margin: Off
              </span>
            )}
            {row.priority && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                {row.priority}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Live Balance",
      accessor: "balance",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div>
            <span className="font-mono font-bold text-sm text-gray-900 block">
              {row.balance || "$0.00"}
            </span>
            <span className="text-[10px] text-gray-400 block font-mono">
              {row.currency || "USD"}
            </span>
          </div>
          <button
            type="button"
            title="Refresh Balance"
            onClick={() => handleCheckBalance(row)}
            disabled={actionLoading[`balance_${row.id}`]}
            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <FaSync className={`text-xs ${actionLoading[`balance_${row.id}`] ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      ),
    },
    {
      header: "Services",
      accessor: "services",
      render: (row) => (
        <Link
          to="/admin/services"
          className="text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 transition px-2.5 py-1 rounded-md inline-flex items-center gap-1"
          title="View mapped services in Service Management"
        >
          <span>{row.services || 0} Services</span>
          <FaExternalLinkAlt className="text-[8px] text-gray-400" />
        </Link>
      ),
    },
    {
      header: "Last Synced",
      accessor: "lastSync",
      className: "text-xs text-gray-500",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-gray-700">
            <span className="font-semibold text-gray-400 text-[10px]">Catalog:</span>
            <span>{row.lastSync || "Never"}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-700">
            <span className="font-semibold text-gray-400 text-[10px]">Orders:</span>
            <span className={row.lastOrderSync === "Just now" ? "text-blue-600 font-semibold" : "text-gray-600"}>
              {row.lastOrderSync || "Never"}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => <Badge status={row.status} size="xs" />,
    },
    {
      header: "Actions",
      accessor: "actions",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          <Button
            size="xs"
            variant="outline"
            title="Test API Handshake & Ping"
            isLoading={actionLoading[`test_${row.id}`]}
            onClick={() => handleTestConnection(row)}
            icon={<FaPlug className="text-emerald-600" />}
          >
            Test
          </Button>

          <Button
            size="xs"
            variant="outline"
            title="Sync Services Catalog"
            isLoading={actionLoading[`sync_${row.id}`]}
            onClick={() => handleSyncServices(row)}
            icon={<FaSync className="text-blue-600" />}
          >
            Sync
          </Button>

          <Button
            size="xs"
            variant="outline"
            title="Sync Order Statuses"
            isLoading={actionLoading[`sync_orders_${row.id}`]}
            onClick={() => handleSyncOrders(row)}
            icon={<FaShoppingCart className="text-amber-600" />}
          >
            Orders
          </Button>

          <Button
            size="xs"
            variant="outline"
            title="Configure Auto Margin Rules"
            onClick={() => handleOpenAutoMargin(row)}
            icon={<FaPercent className="text-indigo-600" />}
          >
            Margin
          </Button>

          <Button
            size="xs"
            variant="ghost"
            title="View Provider Details"
            onClick={() => handleViewDetails(row)}
            icon={<FaEye className="text-gray-600 hover:text-gray-900" />}
          />

          <Button
            size="xs"
            variant="outline"
            title="API Network Logs"
            onClick={() => handleViewLogs(row)}
            icon={<FaHistory className="text-slate-600" />}
          />

          <Button
            size="xs"
            variant="outline"
            title="Edit Configuration"
            onClick={() => handleOpenEdit(row)}
            icon={<FaEdit className="text-blue-600" />}
          />

          <Button
            size="xs"
            variant={row.status === "Active" ? "outline" : "success"}
            title={row.status === "Active" ? "Disable Provider" : "Enable Provider"}
            onClick={() => handleToggleStatus(row)}
            icon={
              row.status === "Active" ? (
                <FaBan className="text-rose-600" />
              ) : (
                <FaCheck className="text-white" />
              )
            }
          />
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Provider Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Connect external SMM APIs, monitor provider balances, and sync catalog services
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProviders(true)}
            disabled={loading || refreshing}
            icon={<FaSync className={refreshing || loading ? "animate-spin text-blue-600" : ""} />}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FaPlus />}
            onClick={handleOpenAdd}
          >
            Add API Provider
          </Button>
        </div>
      </div>

      {/* Top Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Providers</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{metrics.total}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <FaServer />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Providers</p>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">{metrics.active}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center text-lg shrink-0">
            <FaCheckCircle />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Disabled Providers</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-600 mt-0.5">{metrics.disabled}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-lg shrink-0">
            <FaBan />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mapped Services</p>
            <h3 className="text-xl sm:text-2xl font-bold text-indigo-600 mt-0.5">{metrics.totalServices}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-100/80 text-indigo-600 flex items-center justify-center text-lg shrink-0">
            <FaSync />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-rose-600 text-lg shrink-0" />
            <p className="text-xs sm:text-sm text-rose-800 font-medium">{fetchError}</p>
          </div>
          <Button variant="danger" size="xs" onClick={() => fetchProviders(true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={filteredProviders}
        isLoading={loading}
        searchPlaceholder="Search providers by name, URL, or ID..."
        searchValue={search}
        onSearch={setSearch}
        emptyTitle={hasActiveFilters ? "No matching providers found" : "No API providers connected"}
        emptySubtitle={
          hasActiveFilters
            ? "Try adjusting your search criteria or clearing selected filters."
            : "Click 'Add API Provider' above to connect your first provider API."
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleClearFilters}
                icon={<FaTimes className="text-xs" />}
              >
                Clear Filters
              </Button>
            )}
          </div>
        }
      />

      {/* Provider Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title="Provider Details & Overview"
        subtitle={`Configuration for ${selectedProvider?.id}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleSyncOrders(selectedProvider);
              }}
              icon={<FaShoppingCart className="text-amber-600" />}
            >
              Sync Orders
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleOpenAutoMargin(selectedProvider);
              }}
              icon={<FaPercent className="text-indigo-600" />}
            >
              Auto Margin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleSyncServices(selectedProvider);
              }}
              icon={<FaSync className="text-blue-600" />}
            >
              Sync Services
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleOpenEdit(selectedProvider);
              }}
              icon={<FaEdit />}
            >
              Edit Config
            </Button>
            <Button
              variant={selectedProvider?.status === "Active" ? "danger" : "primary"}
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleToggleStatus(selectedProvider);
              }}
              icon={selectedProvider?.status === "Active" ? <FaBan /> : <FaCheck />}
            >
              {selectedProvider?.status === "Active" ? "Disable Provider" : "Enable Provider"}
            </Button>
          </>
        }
      >
        {selectedProvider && (
          <div className="space-y-6">
            {/* Header Profile Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                  <FaServer />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-gray-900">{selectedProvider.name}</h4>
                    <Badge status={selectedProvider.status} size="xs" />
                  </div>
                  <p className="text-xs text-blue-600 font-mono mt-0.5">{selectedProvider.url}</p>
                </div>
              </div>
              <span className="font-mono text-xs text-gray-400 bg-white px-2.5 py-1 rounded border border-gray-200">
                {selectedProvider.id}
              </span>
            </div>

            {/* Key Metric Tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  API Balance
                </span>
                <span className="text-lg font-bold text-emerald-700 font-mono mt-1 block">
                  {selectedProvider.balance || "$0.00"} {selectedProvider.currency}
                </span>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">
                  Mapped Services
                </span>
                <span className="text-lg font-bold text-indigo-700 mt-1 block">
                  {selectedProvider.services || 0}
                </span>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="text-[11px] font-semibold text-purple-800 uppercase tracking-wider block">
                  Priority Queue
                </span>
                <span className="text-lg font-bold text-purple-700 mt-1 block">
                  {selectedProvider.priority || "Medium"}
                </span>
              </div>
            </div>

            {/* Auto Margin Configuration Card */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/40 border border-indigo-100 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                    <FaPercent />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Auto Margin Pricing Strategy
                    </h5>
                    <p className="text-[11px] text-gray-500">
                      Calculates selling price above provider wholesale cost
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      selectedProvider.autoMarginEnabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {selectedProvider.autoMarginEnabled ? "Active & Syncing" : "Disabled (Manual Pricing)"}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setDetailsModalOpen(false);
                      handleOpenAutoMargin(selectedProvider);
                    }}
                    icon={<FaSlidersH className="text-xs text-indigo-600" />}
                  >
                    Configure
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-indigo-100/80">
                <div>
                  <span className="text-gray-500 text-[11px] block">Margin Model:</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {selectedProvider.autoMarginType || "percentage"} Markup
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px] block">Markup Applied:</span>
                  <span className="font-semibold text-indigo-700">
                    {selectedProvider.autoMarginType === "percentage" && `+${selectedProvider.autoMarginPercent ?? 20}%`}
                    {selectedProvider.autoMarginType === "fixed" && `+${selectedProvider.currency === "INR" ? "₹" : "$"}${selectedProvider.autoMarginFixed ?? 5}`}
                    {selectedProvider.autoMarginType === "hybrid" && `+${selectedProvider.autoMarginPercent ?? 20}% + ${selectedProvider.currency === "INR" ? "₹" : "$"}${selectedProvider.autoMarginFixed ?? 5}`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px] block">Floor Minimum Margin:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedProvider.currency === "INR" ? "₹" : "$"}{selectedProvider.minMargin ?? 1.0}
                  </span>
                </div>
              </div>

              {selectedProvider.autoMarginEnabled && (
                <div className="mt-2.5 px-3 py-2 bg-indigo-50/60 rounded-lg text-[11px] text-indigo-900 flex items-center gap-2">
                  <FaInfoCircle className="text-indigo-600 shrink-0 text-xs" />
                  <span>
                    <strong>Live Calculation:</strong> A provider cost of{" "}
                    {selectedProvider.currency === "INR" ? "₹100.00" : "$1.00"} converts to retail rate{" "}
                    <strong>
                      {selectedProvider.currency === "INR"
                        ? `₹${(100 + (selectedProvider.autoMarginType === "fixed" ? Number(selectedProvider.autoMarginFixed || 5) : selectedProvider.autoMarginType === "hybrid" ? 100 * (Number(selectedProvider.autoMarginPercent || 20) / 100) + Number(selectedProvider.autoMarginFixed || 5) : 100 * (Number(selectedProvider.autoMarginPercent || 20) / 100))).toFixed(2)}`
                        : `$${(1.0 + (selectedProvider.autoMarginType === "fixed" ? Number(selectedProvider.autoMarginFixed || 5) : selectedProvider.autoMarginType === "hybrid" ? 1.0 * (Number(selectedProvider.autoMarginPercent || 20) / 100) + Number(selectedProvider.autoMarginFixed || 5) : 1.0 * (Number(selectedProvider.autoMarginPercent || 20) / 100))).toFixed(2)}`}
                    </strong>{" "}
                    per 1k quantity.
                  </span>
                </div>
              )}
            </div>

            {/* Configuration Attributes */}
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs">
              <div className="p-3 flex justify-between items-center">
                <span className="text-gray-500 font-medium">API Endpoint</span>
                <span className="font-mono text-gray-800">{selectedProvider.url}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-gray-500 font-medium">Auto Orders Sync</span>
                <span className={`font-semibold ${selectedProvider.autoSync ? "text-emerald-600" : "text-gray-400"}`}>
                  {selectedProvider.autoSync ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-gray-500 font-medium">Auto Refill Processing</span>
                <span className={`font-semibold ${selectedProvider.autoRefill ? "text-emerald-600" : "text-gray-400"}`}>
                  {selectedProvider.autoRefill ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-gray-500 font-medium">Last Services Catalog Sync</span>
                <span className="text-gray-700">{selectedProvider.lastSync || "Never"}</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-gray-500 font-medium">Last Upstream Orders Sync</span>
                <span className={`font-semibold ${selectedProvider.lastOrderSync === "Just now" ? "text-blue-600" : "text-gray-700"}`}>
                  {selectedProvider.lastOrderSync || "Never"}
                </span>
              </div>
              {selectedProvider.description && (
                <div className="p-3 flex justify-between items-start">
                  <span className="text-gray-500 font-medium">Description / Notes</span>
                  <span className="text-gray-700 max-w-sm text-right">{selectedProvider.description}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Provider Modal */}
      <Modal
        isOpen={addEditModalOpen}
        onClose={() => setAddEditModalOpen(false)}
        title={editingProvider ? "Edit Provider Configuration" : "Add New API Provider"}
        subtitle="Credentials are encrypted server-side and never exposed in plain text"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={isSubmitting}
            >
              {editingProvider ? "Save Changes" : "Connect Provider"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Provider Name"
            required
            placeholder="e.g. SMM Provider Alpha"
            value={formData.name}
            error={formErrors.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="API URL Endpoint"
            required
            placeholder="https://example-provider.com/api/v2"
            value={formData.url}
            error={formErrors.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          />

          {/* API Key Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider API Key / Secret Token {editingProvider ? "" : <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                placeholder={
                  editingProvider
                    ? "•••••••••••••••• (Leave blank to keep current key)"
                    : "Paste provider API secret key..."
                }
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showApiKey ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {formErrors.apiKey ? (
              <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.apiKey}</p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-500">
                Secret tokens are masked in the UI and never exposed in client requests.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Routing Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p} Priority
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.autoSync}
                  onChange={(e) => setFormData({ ...formData, autoSync: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Auto Sync Orders & Status</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.autoRefill}
                  onChange={(e) => setFormData({ ...formData, autoRefill: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Enable Automated Refills</span>
              </label>
            </div>
          </div>

          {/* Auto Margin Section in Provider Form */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={formData.autoMarginEnabled}
                  onChange={(e) => setFormData({ ...formData, autoMarginEnabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-1.5">
                  <FaPercent className="text-xs text-blue-600" />
                  Enable Auto Margin Markup
                </span>
              </label>
              <span className="text-[11px] text-gray-400">
                Auto-adjusts retail catalog rates
              </span>
            </div>

            {formData.autoMarginEnabled && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Margin Strategy
                    </label>
                    <select
                      value={formData.autoMarginType}
                      onChange={(e) => setFormData({ ...formData, autoMarginType: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {MARGIN_TYPES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(formData.autoMarginType === "percentage" || formData.autoMarginType === "hybrid") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Percentage Markup (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="500"
                        placeholder="e.g. 20.0"
                        value={formData.autoMarginPercent}
                        onChange={(e) => setFormData({ ...formData, autoMarginPercent: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>
                  )}

                  {(formData.autoMarginType === "fixed" || formData.autoMarginType === "hybrid") && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Fixed Amount Markup ({formData.currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 5.0"
                        value={formData.autoMarginFixed}
                        onChange={(e) => setFormData({ ...formData, autoMarginFixed: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="px-2.5 py-1.5 bg-white rounded border border-gray-200 text-[11px] text-gray-600 flex items-center justify-between">
                  <span>Simulated Price Preview:</span>
                  <span className="font-medium text-indigo-700 font-mono">
                    {formData.currency}1.00 cost &rarr; {formData.currency}
                    {(
                      1.0 +
                      (formData.autoMarginType === "percentage"
                        ? 1.0 * (Number(formData.autoMarginPercent || 0) / 100)
                        : formData.autoMarginType === "fixed"
                        ? Number(formData.autoMarginFixed || 0)
                        : 1.0 * (Number(formData.autoMarginPercent || 0) / 100) + Number(formData.autoMarginFixed || 0))
                    ).toFixed(2)}{" "}
                    retail rate
                  </span>
                </div>
              </div>
            )}
          </div>

          <Input
            label="Internal Notes / Description"
            placeholder="e.g. Primary provider for fast YouTube views"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </form>
      </Modal>

      {/* Dedicated Auto Margin Configuration Modal */}
      <Modal
        isOpen={autoMarginModalOpen}
        onClose={() => setAutoMarginModalOpen(false)}
        title={`Auto Margin Rules — ${selectedProvider?.name || "Provider"}`}
        subtitle={`Configure markup algorithms and real-time selling price calculation for ${selectedProvider?.id}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoMarginModalOpen(false)}
              disabled={isSavingMargin}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAutoMargin}
              isLoading={isSavingMargin}
              icon={<FaCheck />}
            >
              Save Auto Margin Rules
            </Button>
          </>
        }
      >
        {selectedProvider && (
          <form onSubmit={handleSaveAutoMargin} className="space-y-5">
            {/* Top Status Toggle Banner */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg shrink-0">
                  <FaPercent />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Automated Profit Margin Calculation
                  </h4>
                  <p className="text-xs text-gray-500">
                    When active, catalog service rates update automatically whenever provider costs change
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={marginForm.autoMarginEnabled}
                  onChange={(e) =>
                    setMarginForm({ ...marginForm, autoMarginEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {marginForm.autoMarginEnabled ? (
              <div className="space-y-4">
                {/* Margin Strategy Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Select Margin Strategy Formula
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {MARGIN_TYPES.map((type) => {
                      const isSelected = marginForm.autoMarginType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            setMarginForm({ ...marginForm, autoMarginType: type.value })
                          }
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-gray-900">{type.label}</span>
                            {isSelected && <FaCheckCircle className="text-indigo-600 text-xs" />}
                          </div>
                          <p className="text-[11px] text-gray-500">
                            {type.value === "percentage" && "Adds a dynamic percentage markup on top of provider base rate."}
                            {type.value === "fixed" && "Adds a constant flat markup amount to every imported service."}
                            {type.value === "hybrid" && "Combines both percentage and fixed flat addition for maximum margin protection."}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Input Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50/70 border border-gray-200 rounded-xl">
                  {(marginForm.autoMarginType === "percentage" || marginForm.autoMarginType === "hybrid") && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Percentage Markup (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="500"
                          placeholder="20.0"
                          value={marginForm.autoMarginPercent}
                          onChange={(e) =>
                            setMarginForm({ ...marginForm, autoMarginPercent: e.target.value })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                        />
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 font-mono text-xs">
                          %
                        </span>
                      </div>
                      {marginErrors.autoMarginPercent && (
                        <p className="mt-1 text-[11px] text-rose-600 font-medium">
                          {marginErrors.autoMarginPercent}
                        </p>
                      )}
                    </div>
                  )}

                  {(marginForm.autoMarginType === "fixed" || marginForm.autoMarginType === "hybrid") && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Fixed Amount ({selectedProvider.currency || "USD"}) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="5.0"
                          value={marginForm.autoMarginFixed}
                          onChange={(e) =>
                            setMarginForm({ ...marginForm, autoMarginFixed: e.target.value })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                        />
                      </div>
                      {marginErrors.autoMarginFixed && (
                        <p className="mt-1 text-[11px] text-rose-600 font-medium">
                          {marginErrors.autoMarginFixed}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Minimum Margin Floor ({selectedProvider.currency || "USD"})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1.0"
                      value={marginForm.minMargin}
                      onChange={(e) =>
                        setMarginForm({ ...marginForm, minMargin: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                    />
                    {marginErrors.minMargin ? (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">
                        {marginErrors.minMargin}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-gray-400">
                        Ensures minimum profit even for ultra-low provider cost services.
                      </p>
                    )}
                  </div>
                </div>

                {/* Live Simulation & Pricing Preview Widget */}
                {(() => {
                  const curr = selectedProvider.currency || "USD";
                  const symbol = curr === "INR" ? "₹" : "$";
                  const baseCost = Math.max(0.01, Number(simCost) || 1.0);
                  const pct = Number(marginForm.autoMarginPercent) || 0;
                  const fix = Number(marginForm.autoMarginFixed) || 0;
                  const minM = Number(marginForm.minMargin) || 0;

                  let calcMarkup = 0;
                  if (marginForm.autoMarginType === "percentage") {
                    calcMarkup = baseCost * (pct / 100);
                  } else if (marginForm.autoMarginType === "fixed") {
                    calcMarkup = fix;
                  } else if (marginForm.autoMarginType === "hybrid") {
                    calcMarkup = baseCost * (pct / 100) + fix;
                  }

                  const effectiveMarkup = Math.max(calcMarkup, minM);
                  const finalSellingPrice = baseCost + effectiveMarkup;
                  const netProfitPct = baseCost > 0 ? ((effectiveMarkup / baseCost) * 100).toFixed(1) : "0.0";
                  const isFloorApplied = minM > 0 && calcMarkup < minM;

                  return (
                    <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <FaBolt className="text-amber-400 text-sm" />
                          <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                            Live Pricing Simulator
                          </h5>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-xs text-indigo-200">Simulate Base Cost ({symbol}):</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.01"
                            value={simCost}
                            onChange={(e) => setSimCost(e.target.value)}
                            className="w-24 rounded bg-indigo-950/80 border border-indigo-700 px-2 py-1 text-xs font-mono text-white text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      </div>

                      {/* 4 Calculation Metric Tiles */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-indigo-300 block">
                            Provider Base Cost
                          </span>
                          <span className="text-base font-bold font-mono text-white mt-1 block">
                            {symbol}{baseCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-amber-300 block">
                            Margin Markup {isFloorApplied && "(Floor)"}
                          </span>
                          <span className="text-base font-bold font-mono text-amber-300 mt-1 block">
                            +{symbol}{effectiveMarkup.toFixed(2)}
                          </span>
                        </div>

                        <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-emerald-300 block">
                            Retail Selling Rate
                          </span>
                          <span className="text-base font-bold font-mono text-emerald-300 mt-1 block">
                            {symbol}{finalSellingPrice.toFixed(2)}
                          </span>
                        </div>

                        <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-indigo-200 block">
                            Net Profit Margin
                          </span>
                          <span className="text-base font-bold font-mono text-white mt-1 block">
                            +{netProfitPct}%
                          </span>
                        </div>
                      </div>

                      {/* Formula explanation note */}
                      <div className="text-[11px] text-indigo-200/90 bg-white/5 p-2.5 rounded-lg border border-white/10 flex items-center justify-between gap-2 flex-wrap font-mono">
                        <span>
                          <strong>Formula:</strong> {symbol}{baseCost.toFixed(2)} (Cost) + {symbol}{effectiveMarkup.toFixed(2)} (Markup) = {symbol}{finalSellingPrice.toFixed(2)} (Selling Rate)
                        </span>
                        {isFloorApplied && (
                          <span className="text-amber-300 text-[10px]">
                            * Minimum floor threshold ({symbol}{minM.toFixed(2)}) applied
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-500 text-xs">
                <FaInfoCircle className="mx-auto text-xl text-gray-400 mb-2" />
                <p className="font-semibold text-gray-700">Auto Margin is currently disabled</p>
                <p className="mt-0.5 text-gray-400">
                  Service prices will not be automatically updated when syncing catalogs from {selectedProvider.name}. You will manage prices manually.
                </p>
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Provider API Logs Modal */}
      <Modal
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        title={`API Logs: ${activeProvName}`}
        subtitle="Recent network requests to provider endpoint"
        footer={
          <Button variant="outline" size="sm" onClick={() => setLogsModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          {selectedLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No recent network logs recorded for this provider.
            </div>
          ) : (
            selectedLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50/80 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-gray-900 font-mono">{log.action}</p>
                  <p className="text-[11px] text-gray-500 truncate max-w-xs">{log.endpoint}</p>
                  <span className="text-gray-400 text-[10px] block mt-0.5">{log.timestamp}</span>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    HTTP {log.httpStatus || 200}
                  </span>
                  <span className="text-gray-400 text-[10px] block font-mono mt-1">
                    {log.responseTime}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Universal Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, provider: null, action: null })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.title || `${confirmDialog.action} Provider`}
        message={
          confirmDialog.message ||
          `Are you sure you want to proceed with this action for ${confirmDialog.provider?.name}?`
        }
        confirmText={confirmDialog.confirmText || confirmDialog.action || "Confirm"}
        variant={confirmDialog.variant || (confirmDialog.action === "Disabled" ? "danger" : "primary")}
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}

export default AdminProviders;
