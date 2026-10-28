/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaRedoAlt,
  FaTimesCircle,
  FaFileExport,
  FaPlus,
  FaEye,
  FaExternalLinkAlt,
  FaFileUpload,
  FaSync,
  FaCheckCircle,
  FaClock,
  FaBox,
  FaDollarSign,
  FaExclamationTriangle,
  FaFileCsv,
  FaCheck,
  FaTimes,
  FaCopy,
  FaTint,
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

const STATUSES = [
  "all",
  "Pending",
  "Processing",
  "In Progress",
  "Completed",
  "Partial",
  "Cancelled",
  "Refunded",
];

function AdminOrders() {
  const { addToast } = useToast();

  // Primary State
  const [orders, setOrders] = useState([]);
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Client Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [massOrderOpen, setMassOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Action Confirmations
  const [confirmAction, setConfirmAction] = useState({
    isOpen: false,
    order: null,
    action: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual Order Form State (Enhanced with Drip-Feed)
  const [manualForm, setManualForm] = useState({
    username: "",
    serviceId: "101",
    link: "",
    quantity: 1000,
    isDripFeed: false,
    dripRuns: "5",
    dripInterval: "60",
  });
  const [manualFormErrors, setManualFormErrors] = useState({});

  // Mass Order CSV State
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvProcessing, setCsvProcessing] = useState(false);

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      const [ordersData, providersData, servicesData] = await Promise.all([
        adminService.getOrders(),
        adminService.getProviders(),
        adminService.getServices(),
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProviders(Array.isArray(providersData) ? providersData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);

      if (isManualRefresh) {
        addToast("Order list refreshed successfully", "success");
      }
    } catch (err) {
      console.error("Failed to load orders data:", err);
      setFetchError("Unable to load orders. Please check your connection.");
      addToast("Failed to load orders", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------
  // Filter & Search Handlers (with page reset)
  // -------------------------------------------------------------
  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusTabChange = (status) => {
    setStatusTab(status);
    setCurrentPage(1);
  };

  const handleProviderFilterChange = (provider) => {
    setProviderFilter(provider);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (range) => {
    setDateFilter(range);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusTab("all");
    setProviderFilter("all");
    setDateFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusTab !== "all" ||
    providerFilter !== "all" ||
    dateFilter !== "all";

  // -------------------------------------------------------------
  // KPI Metrics Calculations
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(
      (o) => o.status === "Pending" || o.status === "Processing" || o.status === "In Progress"
    ).length;
    const completed = orders.filter((o) => o.status === "Completed").length;
    const cancelled = orders.filter(
      (o) => o.status === "Cancelled" || o.status === "Refunded"
    ).length;
    const totalCharged = orders.reduce((acc, o) => {
      const num = typeof o.charge === "number" ? o.charge : parseFloat(String(o.amount || "0").replace(/[^0-9.]/g, "")) || 0;
      return acc + num;
    }, 0);

    return { total, pending, completed, cancelled, totalCharged };
  }, [orders]);

  // -------------------------------------------------------------
  // Filtered & Paginated Orders
  // -------------------------------------------------------------
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((o) => {
      const idStr = String(o.id || "").toLowerCase();
      const userStr = String(o.user || o.username || "").toLowerCase();
      const serviceStr = String(o.service || "").toLowerCase();
      const linkStr = String(o.link || "").toLowerCase();
      const provStr = String(o.provider || "").toLowerCase();
      const provOrderStr = String(o.providerOrderId || "").toLowerCase();

      const matchesSearch =
        !query ||
        idStr.includes(query) ||
        userStr.includes(query) ||
        serviceStr.includes(query) ||
        linkStr.includes(query) ||
        provStr.includes(query) ||
        provOrderStr.includes(query);

      const matchesTab =
        statusTab === "all" || (o.status && o.status.toLowerCase() === statusTab.toLowerCase());

      const matchesProvider =
        providerFilter === "all" || (o.provider && o.provider === providerFilter);

      const matchesDate = (() => {
        if (dateFilter === "all") return true;
        const orderDateStr = o.createdAt || o.date;
        if (!orderDateStr) return true;
        const orderDate = new Date(orderDateStr.replace(" ", "T"));
        if (isNaN(orderDate.getTime())) return true;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === "today") {
          return orderDate >= startOfToday;
        }
        if (dateFilter === "7days") {
          const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= past7;
        }
        if (dateFilter === "30days") {
          const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= past30;
        }
        if (dateFilter === "thisMonth") {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return orderDate >= startOfMonth;
        }
        return true;
      })();

      return matchesSearch && matchesTab && matchesProvider && matchesDate;
    });
  }, [orders, search, statusTab, providerFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedOrders = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, safeCurrentPage, pageSize]);

  // -------------------------------------------------------------
  // Order Details Modal Handlers
  // -------------------------------------------------------------
  const handleOpenDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    addToast(`${label || "Text"} copied to clipboard`, "info");
  };

  // -------------------------------------------------------------
  // Order Actions Handlers
  // -------------------------------------------------------------
  const handleTriggerAction = (order, action) => {
    setConfirmAction({
      isOpen: true,
      order,
      action,
    });
  };

  const executeOrderAction = async () => {
    const { order, action } = confirmAction;
    if (!order) return;

    setIsSubmitting(true);
    try {
      if (action === "Refill") {
        const res = await adminService.refillOrder(order.id);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, refillStatus: "Requested" } : o
          )
        );
        if (selectedOrder && selectedOrder.id === order.id) {
          setSelectedOrder((prev) => ({ ...prev, refillStatus: "Requested" }));
        }
        addToast(
          res.message || `Refill request dispatched for Order #${order.id}`,
          "success"
        );
      } else if (action === "Cancel & Refund") {
        await adminService.cancelAndRefundOrder(order.id);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: "Refunded", remains: o.quantity } : o
          )
        );
        if (selectedOrder && selectedOrder.id === order.id) {
          setSelectedOrder((prev) => ({ ...prev, status: "Refunded", remains: prev.quantity }));
        }
        addToast(`Order #${order.id} cancelled & ${order.amount || "amount"} refunded to customer wallet`, "success");
      } else if (action === "Complete") {
        await adminService.updateOrderStatus(order.id, "Completed");
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: "Completed", remains: 0 } : o
          )
        );
        if (selectedOrder && selectedOrder.id === order.id) {
          setSelectedOrder((prev) => ({ ...prev, status: "Completed", remains: 0 }));
        }
        addToast(`Order #${order.id} marked as Completed`, "success");
      }
    } catch (err) {
      console.error(`Order action error (${action}):`, err);
      addToast(`Action failed: ${action}`, "error");
    } finally {
      setIsSubmitting(false);
      setConfirmAction({ isOpen: false, order: null, action: null });
    }
  };

  // -------------------------------------------------------------
  // Manual Order Handlers
  // -------------------------------------------------------------
  const handleOpenManualOrder = () => {
    const defaultService = services[0] || { id: 101, rate: 0.25, name: "Instagram Followers" };
    setManualForm({
      username: "",
      serviceId: String(defaultService.id || "101"),
      link: "",
      quantity: defaultService.min || 1000,
      isDripFeed: false,
      dripRuns: "5",
      dripInterval: "60",
    });
    setManualFormErrors({});
    setManualOrderOpen(true);
  };

  const selectedManualService = useMemo(() => {
    return (
      services.find((s) => String(s.id) === String(manualForm.serviceId)) ||
      services[0] || {
        id: 101,
        name: "Instagram Followers - High Quality",
        rate: 0.25,
        min: 100,
        max: 100000,
        provider: "SMM Provider One",
      }
    );
  }, [services, manualForm.serviceId]);

  const estimatedCharge = useMemo(() => {
    const qty = Number(manualForm.quantity) || 0;
    const ratePerK = Number(selectedManualService.rate) || 0.25;
    const total = (qty * ratePerK) / 1000;
    return `₹${total.toFixed(2)}`;
  }, [manualForm.quantity, selectedManualService]);

  const handleManualOrderSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!manualForm.username.trim()) {
      errors.username = "Customer username is required";
    }

    if (!manualForm.link.trim()) {
      errors.link = "Target link or profile URL is required";
    } else if (!/^https?:\/\/.+/i.test(manualForm.link.trim())) {
      errors.link = "Please provide a valid URL starting with http:// or https://";
    }

    const qty = Number(manualForm.quantity);
    const minQty = selectedManualService.min || 10;
    const maxQty = selectedManualService.max || 1000000;

    if (isNaN(qty) || qty <= 0) {
      errors.quantity = "Quantity must be a positive integer";
    } else if (qty < minQty) {
      errors.quantity = `Minimum quantity for this service is ${minQty.toLocaleString()}`;
    } else if (qty > maxQty) {
      errors.quantity = `Maximum quantity for this service is ${maxQty.toLocaleString()}`;
    }

    if (manualForm.isDripFeed) {
      const runs = Number(manualForm.dripRuns);
      const interval = Number(manualForm.dripInterval);

      if (isNaN(runs) || runs < 2 || runs > 100 || !Number.isInteger(runs)) {
        errors.dripRuns = "Runs count must be an integer between 2 and 100";
      }

      if (isNaN(interval) || interval < 10 || interval > 1440 || !Number.isInteger(interval)) {
        errors.dripInterval = "Interval must be between 10 and 1440 minutes";
      }
    }

    if (Object.keys(errors).length > 0) {
      setManualFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const chargeNum = parseFloat(estimatedCharge.replace(/[^0-9.]/g, "")) || 50.0;
      const created = await adminService.createOrder({
        user: manualForm.username.trim(),
        service: selectedManualService.name || "Custom Order Service",
        serviceId: selectedManualService.id || 101,
        category: selectedManualService.category || "Manual Order",
        link: manualForm.link.trim(),
        quantity: qty,
        charge: chargeNum,
        amount: estimatedCharge,
        provider: selectedManualService.provider || "Direct Admin Order",
        providerOrderId: `PRV-MAN-${Math.floor(10000 + Math.random() * 90000)}`,
        status: "Processing",
        isDripFeed: manualForm.isDripFeed,
        dripRuns: manualForm.isDripFeed ? Number(manualForm.dripRuns) : undefined,
        dripInterval: manualForm.isDripFeed ? Number(manualForm.dripInterval) : undefined,
      });

      setOrders((prev) => [created, ...prev]);
      addToast(`Manual order #${created.id} submitted successfully`, "success");
      setManualOrderOpen(false);
    } catch (err) {
      console.error("Manual order creation error:", err);
      addToast("Failed to create manual order", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Mass Order CSV Handlers
  // -------------------------------------------------------------
  const handleOpenMassOrder = () => {
    setCsvFile(null);
    setCsvFileName("");
    setCsvParsedRows([]);
    setCsvParsing(false);
    setCsvProcessing(false);
    setMassOrderOpen(true);
  };

  const handleCsvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      addToast("Please upload a valid .csv file", "error");
      return;
    }

    setCsvFile(file);
    setCsvFileName(file.name);
    parseCsvFile(file);
  };

  const parseCsvFile = (file) => {
    setCsvParsing(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const text = evt.target?.result || "";
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          addToast("The selected CSV file is empty", "error");
          setCsvParsedRows([]);
          setCsvParsing(false);
          return;
        }

        const rows = [];
        let startIndex = 0;

        // Check if first line is a header
        const firstLineLower = lines[0].toLowerCase();
        if (
          firstLineLower.includes("service") ||
          firstLineLower.includes("link") ||
          firstLineLower.includes("quantity")
        ) {
          startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
          const serviceId = parts[0] || "";
          const link = parts[1] || "";
          const quantity = parts[2] || "";

          const errors = [];
          if (!serviceId) errors.push("Missing service ID");
          if (!link) {
            errors.push("Missing target URL");
          } else if (!/^https?:\/\/.+/i.test(link)) {
            errors.push("Invalid URL format");
          }

          const qtyNum = Number(quantity);
          if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
            errors.push("Quantity must be a positive number");
          }

          rows.push({
            rowNumber: i + 1,
            raw: line,
            serviceId,
            link,
            quantity: qtyNum || 0,
            isValid: errors.length === 0,
            errors,
          });
        }

        setCsvParsedRows(rows);
      } catch (err) {
        console.error("CSV Parse Error:", err);
        addToast("Failed to parse CSV file content", "error");
      } finally {
        setCsvParsing(false);
      }
    };

    reader.onerror = () => {
      addToast("Failed to read CSV file", "error");
      setCsvParsing(false);
    };

    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = "service_id,link,quantity\n101,https://instagram.com/sample_profile,1000\n103,https://instagram.com/p/C9vXy8Z2Qp,500\n107,https://youtube.com/watch?v=dQw4w9WgXcQ,2500";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "mass_order_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessMassOrders = async () => {
    const validRows = csvParsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      addToast("No valid rows found to process in CSV", "error");
      return;
    }

    setCsvProcessing(true);
    try {
      // Simulate bulk order creation via mock service
      const ordersToCreate = validRows.map((r) => {
        const matchedService = services.find((s) => String(s.id) === String(r.serviceId));
        return {
          user: "CSV Bulk Client",
          service: matchedService ? matchedService.name : `Imported Service #${r.serviceId}`,
          serviceId: r.serviceId,
          category: matchedService ? matchedService.category : "Bulk Import",
          link: r.link,
          quantity: r.quantity,
          charge: matchedService ? (r.quantity * matchedService.rate) / 1000 : 25.0,
          provider: matchedService ? matchedService.provider : "SMM Provider One",
        };
      });

      const res = await adminService.createMassOrders(ordersToCreate);
      setOrders((prev) => [...(res.orders || []), ...prev]);
      addToast(
        `Successfully placed ${res.count || validRows.length} mass orders from CSV (${csvParsedRows.length - validRows.length} invalid rows skipped)`,
        "success"
      );
      setMassOrderOpen(false);
    } catch (err) {
      console.error("Mass order processing error:", err);
      addToast("Failed to process mass orders", "error");
    } finally {
      setCsvProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // CSV Export Handler
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      addToast("No orders available to export", "info");
      return;
    }

    const headers = [
      "Order ID",
      "Customer",
      "Service",
      "Target Link",
      "Quantity",
      "Remains",
      "Charge",
      "Provider",
      "Provider Order ID",
      "Status",
      "Date",
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredOrders.map((o) => [
      escapeCsv(o.id || "N/A"),
      escapeCsv(o.user || o.username || "N/A"),
      escapeCsv(o.service || "N/A"),
      escapeCsv(o.link || "N/A"),
      o.quantity || 0,
      o.remains !== undefined ? o.remains : "N/A",
      escapeCsv(o.amount || (o.charge ? `₹${o.charge.toFixed(2)}` : "N/A")),
      escapeCsv(o.provider || "N/A"),
      escapeCsv(o.providerOrderId || "N/A"),
      escapeCsv(o.status || "N/A"),
      escapeCsv(o.createdAt || o.date || "N/A"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `gromage-orders-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${filteredOrders.length} orders to CSV`, "success");
  };

  // -------------------------------------------------------------
  // Reusable DataTable Column Definitions
  // -------------------------------------------------------------
  const columns = [
    {
      header: "Order ID",
      accessor: "id",
      sortable: true,
      className: "w-28",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {row.id || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Customer",
      accessor: "user",
      sortable: true,
      render: (row) => (
        <div className="text-xs">
          <p className="font-bold text-gray-900">{row.user || row.username || "Unknown"}</p>
          <p className="text-[11px] text-gray-400 font-mono">{row.userId || "Customer"}</p>
        </div>
      ),
    },
    {
      header: "Service & Target Link",
      accessor: "service",
      render: (row) => (
        <div className="max-w-xs space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-xs text-gray-900 truncate" title={row.service}>
              {row.service || "Unnamed Service"}
            </p>
            {row.isDripFeed && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 shrink-0"
                title={`Drip-Feed: ${row.dripFeed?.completedRuns || 0}/${row.dripFeed?.runs || 5} batches completed`}
              >
                <FaTint className="text-[9px]" /> Drip-Feed
              </span>
            )}
            {(row.providerOrderId?.includes("CSV") || row.category === "Bulk Import") && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 shrink-0"
                title="Mass CSV Queue Import"
              >
                <FaFileCsv className="text-[9px]" /> Mass CSV
              </span>
            )}
          </div>
          {row.link ? (
            <a
              href={row.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 truncate max-w-full"
              title={row.link}
            >
              <span className="truncate">{row.link}</span>
              <FaExternalLinkAlt className="text-[9px] shrink-0" />
            </a>
          ) : (
            <span className="text-[11px] text-gray-400 italic">No link provided</span>
          )}
        </div>
      ),
    },
    {
      header: "Quantity",
      accessor: "quantity",
      sortable: true,
      render: (row) => (
        <div className="text-xs">
          <span className="font-mono font-bold text-gray-900">
            {typeof row.quantity === "number" ? row.quantity.toLocaleString() : row.quantity || "0"}
          </span>
          {row.isDripFeed && row.dripFeed && (
            <p className="text-[10px] text-blue-600 font-medium">
              {row.dripFeed.completedRuns || 0}/{row.dripFeed.runs} runs ({Math.floor((row.quantity || 0) / (row.dripFeed.runs || 1)).toLocaleString()}/run)
            </p>
          )}
          {row.remains !== undefined && row.remains > 0 && (
            <p className="text-[10px] text-amber-600 font-mono">
              Remains: {row.remains.toLocaleString()}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Charge",
      accessor: "charge",
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-gray-900">
          {row.amount || (typeof row.charge === "number" ? `₹${row.charge.toFixed(2)}` : "₹0.00")}
        </span>
      ),
    },
    {
      header: "Provider",
      accessor: "provider",
      sortable: true,
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-gray-800">{row.provider || "Direct"}</span>
          {row.providerOrderId && (
            <p className="text-[10px] font-mono text-gray-400 truncate">
              {row.providerOrderId}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      sortable: true,
      render: (row) => <Badge status={row.status || "Pending"} size="xs" />,
    },
    {
      header: "Placed Date",
      accessor: "createdAt",
      sortable: true,
      className: "text-[11px] text-gray-500 whitespace-nowrap",
      render: (row) => (
        <span className="text-[11px] text-gray-500">
          {row.createdAt || row.date || "N/A"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      className: "text-right",
      render: (row) => {
        const canRefill =
          row.status === "Completed" || row.status === "Partial" || row.status === "In Progress";
        const canComplete =
          row.status === "Pending" || row.status === "Processing" || row.status === "In Progress";
        const canCancel =
          row.status === "Pending" || row.status === "Processing" || row.status === "In Progress";

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="xs"
              variant="outline"
              title="View Order Details & Timeline"
              onClick={() => handleOpenDetail(row)}
              icon={<FaEye className="text-gray-600" />}
            />

            {canRefill && (
              <Button
                size="xs"
                variant="outline"
                title="Trigger Refill"
                onClick={() => handleTriggerAction(row, "Refill")}
                icon={<FaRedoAlt className="text-blue-600" />}
              />
            )}

            {canComplete && (
              <Button
                size="xs"
                variant="outline"
                title="Mark Completed"
                onClick={() => handleTriggerAction(row, "Complete")}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                icon={<FaCheckCircle />}
              />
            )}

            {canCancel && (
              <Button
                size="xs"
                variant="outline"
                title="Cancel Order & Refund Wallet"
                onClick={() => handleTriggerAction(row, "Cancel & Refund")}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                icon={<FaTimesCircle />}
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Order Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Monitor client orders, manage refills, process refunds, and dispatch bulk CSV queues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            icon={<FaSync className={refreshing || loading ? "animate-spin text-blue-600" : ""} />}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<FaFileExport />}
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
          >
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            icon={<FaFileUpload />}
            onClick={handleOpenMassOrder}
          >
            Mass Order CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FaPlus />}
            onClick={handleOpenManualOrder}
          >
            New Manual Order
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div
          onClick={() => handleStatusTabChange("all")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusTab === "all" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 font-mono">
                {metrics.total.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
              <FaBox />
            </div>
          </div>
        </div>

        <div
          onClick={() => handleStatusTabChange("Processing")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusTab === "Processing" || statusTab === "Pending" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Queue / Processing</p>
              <h3 className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5 font-mono">
                {metrics.pending.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg shrink-0">
              <FaClock />
            </div>
          </div>
        </div>

        <div
          onClick={() => handleStatusTabChange("Completed")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusTab === "Completed" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 font-mono">
                {metrics.completed.toLocaleString()}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
              <FaCheckCircle />
            </div>
          </div>
        </div>

        <div
          onClick={() => handleStatusTabChange("Refunded")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusTab === "Refunded" || statusTab === "Cancelled" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Value / Volume</p>
              <h3 className="text-lg sm:text-xl font-black text-gray-900 mt-0.5 font-mono">
                ₹{metrics.totalCharged.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
              <FaDollarSign />
            </div>
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
          <Button variant="danger" size="xs" onClick={() => loadData(true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 hide-scrollbar">
        {STATUSES.map((tab) => {
          const count =
            tab === "all"
              ? orders.length
              : orders.filter((o) => o.status?.toLowerCase() === tab.toLowerCase()).length;

          return (
            <button
              key={tab}
              onClick={() => handleStatusTabChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                statusTab === tab
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <span>{tab === "all" ? "All Orders" : tab}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  statusTab === tab ? "bg-blue-700/80 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Order DataTable */}
      <DataTable
        columns={columns}
        data={paginatedOrders}
        isLoading={loading}
        searchPlaceholder="Search by Order ID, customer, service, link, provider..."
        searchValue={search}
        onSearch={handleSearchChange}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Dynamic Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => handleProviderFilterChange(e.target.value)}
              className="py-2 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
            >
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <select
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="py-2 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
            </select>

            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-2 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>

            {/* Reset Filters Action */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2 py-1.5 hover:bg-rose-50 rounded-lg transition"
              >
                <FaTimes className="text-[10px]" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        }
        emptyTitle={hasActiveFilters ? "No matching orders found" : "No orders recorded yet"}
        emptySubtitle={
          hasActiveFilters
            ? "Try adjusting your search keywords, status tabs, or provider filters."
            : "Incoming client orders or manual placements will show up here."
        }
        pagination={{
          page: safeCurrentPage,
          pageSize: pageSize,
          totalItems: filteredOrders.length,
          totalPages: totalPages,
          onPageChange: (newPage) => setCurrentPage(newPage),
        }}
      />

      {/* ========================================================= */}
      {/* 1. ORDER DETAILS MODAL                                   */}
      {/* ========================================================= */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Order Details: ${selectedOrder?.id || "ORD"}`}
        subtitle={`Placed on ${selectedOrder?.createdAt || selectedOrder?.date || "N/A"}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {selectedOrder && selectedOrder.status === "Completed" && (
                <Button
                  size="xs"
                  variant="outline"
                  icon={<FaRedoAlt className="text-blue-600" />}
                  onClick={() => handleTriggerAction(selectedOrder, "Refill")}
                >
                  Request Refill
                </Button>
              )}
              {selectedOrder &&
                (selectedOrder.status === "Pending" ||
                  selectedOrder.status === "Processing" ||
                  selectedOrder.status === "In Progress") && (
                  <>
                    <Button
                      size="xs"
                      variant="outline"
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      icon={<FaCheckCircle />}
                      onClick={() => handleTriggerAction(selectedOrder, "Complete")}
                    >
                      Mark Completed
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      icon={<FaTimesCircle />}
                      onClick={() => handleTriggerAction(selectedOrder, "Cancel & Refund")}
                    >
                      Cancel & Refund
                    </Button>
                  </>
                )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetailModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-4 text-sm">
            {/* Status & Amount Overview Card */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Order Status</p>
                <div className="mt-1">
                  <Badge status={selectedOrder.status} size="md" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Total Charge</p>
                <p className="text-xl font-black text-gray-900 font-mono">
                  {selectedOrder.amount || (selectedOrder.charge ? `₹${selectedOrder.charge.toFixed(2)}` : "N/A")}
                </p>
              </div>
            </div>

            {/* Core Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-white rounded-xl border border-gray-200 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">Customer</span>
                <span className="font-bold text-gray-900">{selectedOrder.user || selectedOrder.username || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Customer ID</span>
                <span className="font-mono text-gray-700">{selectedOrder.userId || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Provider</span>
                <span className="font-semibold text-gray-900">{selectedOrder.provider || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Provider Order ID</span>
                <span className="font-mono font-bold text-blue-600">
                  {selectedOrder.providerOrderId || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Ordered Quantity</span>
                <span className="font-mono font-bold text-gray-900">
                  {typeof selectedOrder.quantity === "number" ? selectedOrder.quantity.toLocaleString() : selectedOrder.quantity || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Remaining</span>
                <span className="font-mono font-bold text-gray-700">
                  {selectedOrder.remains !== undefined ? selectedOrder.remains.toLocaleString() : "0"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Start Count</span>
                <span className="font-mono text-gray-700">
                  {selectedOrder.startCount !== undefined ? selectedOrder.startCount.toLocaleString() : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Refill Status</span>
                <span className="font-semibold text-gray-800">{selectedOrder.refillStatus || "Not Applicable"}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Last Synced</span>
                <span className="text-gray-700">{selectedOrder.updatedAt || selectedOrder.createdAt || "N/A"}</span>
              </div>
            </div>

            {/* Drip-Feed Schedule Progress Card */}
            {(selectedOrder.isDripFeed || selectedOrder.dripFeed) && (
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <FaTint className="text-blue-600" />
                    Drip-Feed Delivery Schedule
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                    {selectedOrder.dripFeed?.completedRuns || 0} of {selectedOrder.dripFeed?.runs || 5} Runs Completed
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-blue-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((selectedOrder.dripFeed?.completedRuns || 0) /
                            (selectedOrder.dripFeed?.runs || 5)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] text-blue-900">
                  <div>
                    <span className="text-blue-600 block text-[10px]">Batch Quantity</span>
                    <span className="font-bold font-mono">
                      ~{Math.floor(
                        (selectedOrder.quantity || 0) /
                          (selectedOrder.dripFeed?.runs || 5)
                      ).toLocaleString()} / run
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 block text-[10px]">Dispatch Interval</span>
                    <span className="font-bold">{selectedOrder.dripFeed?.interval || 60} mins</span>
                  </div>
                  <div>
                    <span className="text-blue-600 block text-[10px]">Schedule State</span>
                    <span className="font-bold text-emerald-700">
                      {selectedOrder.status === "Completed"
                        ? "Completed"
                        : "Active Queue"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Service & Target Link */}
            <div>
              <span className="text-xs font-semibold text-gray-700 block mb-1">Service</span>
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-medium text-gray-900">
                {selectedOrder.service || "N/A"}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">Target Link / URL</span>
                {selectedOrder.link && (
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedOrder.link, "Target Link")}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <FaCopy className="text-[10px]" />
                    <span>Copy Link</span>
                  </button>
                )}
              </div>
              {selectedOrder.link ? (
                <a
                  href={selectedOrder.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-blue-600 bg-blue-50/70 border border-blue-100 p-2.5 rounded-lg block break-all hover:underline"
                >
                  {selectedOrder.link}
                </a>
              ) : (
                <div className="text-xs font-mono text-gray-400 bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                  N/A
                </div>
              )}
            </div>

            {/* Order Timeline */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                Order Activity Timeline
              </p>
              <div className="space-y-3 pl-3 border-l-2 border-blue-500 text-xs">
                <div className="relative">
                  <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
                  <p className="font-semibold text-gray-900">Order Placed & Wallet Deducted</p>
                  <p className="text-gray-500 text-[11px]">{selectedOrder.createdAt || selectedOrder.date || "N/A"}</p>
                </div>

                {(selectedOrder.providerOrderId?.includes("CSV") || selectedOrder.category === "Bulk Import") && (
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-white" />
                    <p className="font-semibold text-gray-900">Imported via Mass Orders CSV Queue</p>
                    <p className="text-gray-500 text-[11px]">Batch parsed and queued for upstream dispatch</p>
                  </div>
                )}

                {(selectedOrder.isDripFeed || selectedOrder.dripFeed) && (
                  <div className="relative">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-4 ring-white" />
                    <p className="font-semibold text-gray-900">Drip-Feed Multi-Run Schedule Initialized</p>
                    <p className="text-gray-500 text-[11px]">
                      Configured for {selectedOrder.dripFeed?.runs || 5} batches every {selectedOrder.dripFeed?.interval || 60} mins
                    </p>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-blue-400 ring-4 ring-white" />
                  <p className="font-semibold text-gray-900">Dispatched to Upstream Provider API</p>
                  <p className="text-gray-500 text-[11px]">
                    Provider: {selectedOrder.provider || "Direct"} • API ID: {selectedOrder.providerOrderId || "Queued"}
                  </p>
                </div>
                <div className="relative">
                  <div
                    className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                      selectedOrder.status === "Completed"
                        ? "bg-emerald-500"
                        : selectedOrder.status === "Refunded" || selectedOrder.status === "Cancelled"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`}
                  />
                  <p className="font-semibold text-gray-900">Current Status: {selectedOrder.status}</p>
                  <p className="text-gray-500 text-[11px]">
                    {selectedOrder.status === "Completed"
                      ? "Order fulfilled successfully with start count verified"
                      : selectedOrder.status === "Refunded"
                      ? "Funds credited back to user wallet"
                      : "Processing in queue"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* 2. MANUAL ORDER MODAL                                     */}
      {/* ========================================================= */}
      <Modal
        isOpen={manualOrderOpen}
        onClose={() => setManualOrderOpen(false)}
        title="Create Manual Order"
        subtitle="Place an order directly on behalf of a registered customer"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setManualOrderOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualOrderSubmit}
              isLoading={isSubmitting}
            >
              Submit Order
            </Button>
          </>
        }
      >
        <form onSubmit={handleManualOrderSubmit} className="space-y-4 text-xs">
          {/* Customer Username */}
          <div>
            <Input
              label="Customer Username / Name"
              required
              placeholder="e.g. rahul_verma or Rahul Sharma"
              value={manualForm.username}
              onChange={(e) => {
                setManualForm({ ...manualForm, username: e.target.value });
                if (manualFormErrors.username) {
                  setManualFormErrors({ ...manualFormErrors, username: null });
                }
              }}
            />
            {manualFormErrors.username && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{manualFormErrors.username}</p>
            )}
          </div>

          {/* Service Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Service <span className="text-rose-500">*</span>
            </label>
            <select
              value={manualForm.serviceId}
              onChange={(e) => setManualForm({ ...manualForm, serviceId: e.target.value })}
              className="w-full py-2 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} - {s.name} (₹{((Number(s.rate) || 0.25) * 100).toFixed(2)}/1k • Min: {s.min || 100})
                </option>
              ))}
            </select>
          </div>

          {/* Target Link */}
          <div>
            <Input
              label="Target Link / Profile URL"
              required
              placeholder="https://instagram.com/p/... or https://youtube.com/..."
              value={manualForm.link}
              onChange={(e) => {
                setManualForm({ ...manualForm, link: e.target.value });
                if (manualFormErrors.link) {
                  setManualFormErrors({ ...manualFormErrors, link: null });
                }
              }}
            />
            {manualFormErrors.link && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{manualFormErrors.link}</p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <Input
              label={`Quantity (Min: ${(selectedManualService.min || 10).toLocaleString()} • Max: ${(selectedManualService.max || 1000000).toLocaleString()})`}
              type="number"
              required
              min={selectedManualService.min || 10}
              max={selectedManualService.max || 1000000}
              value={manualForm.quantity}
              onChange={(e) => {
                setManualForm({ ...manualForm, quantity: e.target.value });
                if (manualFormErrors.quantity) {
                  setManualFormErrors({ ...manualFormErrors, quantity: null });
                }
              }}
            />
            {manualFormErrors.quantity && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{manualFormErrors.quantity}</p>
            )}
          </div>

          {/* Drip-Feed Scheduling Configuration */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualForm.isDripFeed}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, isDripFeed: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <FaTint className="text-blue-500 text-xs" />
                  Enable Drip-Feed Scheduling
                </span>
              </label>
              <span className="text-[11px] text-gray-400">Automated multi-run batches</span>
            </div>

            {manualForm.isDripFeed && (
              <div className="pt-2.5 border-t border-gray-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Runs / Batches (2 - 100) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={manualForm.dripRuns}
                      onChange={(e) => {
                        setManualForm({ ...manualForm, dripRuns: e.target.value });
                        if (manualFormErrors.dripRuns) {
                          setManualFormErrors({ ...manualFormErrors, dripRuns: null });
                        }
                      }}
                      className="w-full py-1.5 px-2.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="e.g. 5"
                    />
                    {manualFormErrors.dripRuns && (
                      <p className="text-rose-600 text-[10px] mt-0.5 font-medium">
                        {manualFormErrors.dripRuns}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Interval in Minutes (10 - 1440) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1440}
                      value={manualForm.dripInterval}
                      onChange={(e) => {
                        setManualForm({ ...manualForm, dripInterval: e.target.value });
                        if (manualFormErrors.dripInterval) {
                          setManualFormErrors({ ...manualFormErrors, dripInterval: null });
                        }
                      }}
                      className="w-full py-1.5 px-2.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="e.g. 60"
                    />
                    {manualFormErrors.dripInterval && (
                      <p className="text-rose-600 text-[10px] mt-0.5 font-medium">
                        {manualFormErrors.dripInterval}
                      </p>
                    )}
                  </div>
                </div>

                {/* Batch calculation preview */}
                <div className="p-2 bg-blue-50/70 rounded-lg border border-blue-100 text-[11px] text-blue-800">
                  Batch Breakdown: ~<strong>
                    {Math.floor(
                      (Number(manualForm.quantity) || 0) /
                        Math.max(1, Number(manualForm.dripRuns) || 1)
                    ).toLocaleString()}
                  </strong> units dispatched every <strong>{manualForm.dripInterval || 60} mins</strong> across <strong>{manualForm.dripRuns || 5} runs</strong>.
                </div>
              </div>
            )}
          </div>

          {/* Pricing Estimation Card */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-900 font-medium">Estimated Charge</p>
              <p className="text-[11px] text-blue-700">
                Routed to: <span className="font-semibold">{selectedManualService.provider || "Default Provider"}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-blue-900 font-mono">{estimatedCharge}</span>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* 3. MASS ORDER CSV MODAL                                   */}
      {/* ========================================================= */}
      <Modal
        isOpen={massOrderOpen}
        onClose={() => setMassOrderOpen(false)}
        title="Mass Orders CSV Processing"
        subtitle="Upload and process bulk orders via structured CSV file"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="xs"
              icon={<FaFileCsv className="text-emerald-600" />}
              onClick={handleDownloadSampleCsv}
            >
              Sample Template
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMassOrderOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleProcessMassOrders}
                disabled={csvProcessing || csvParsedRows.filter((r) => r.isValid).length === 0}
                isLoading={csvProcessing}
              >
                Process Orders ({csvParsedRows.filter((r) => r.isValid).length})
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Drag & Drop File Input Box */}
          <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 text-center bg-gray-50/70 hover:bg-blue-50/30 transition cursor-pointer block">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileSelect}
              className="hidden"
            />
            <FaFileUpload className="text-3xl text-gray-400 mx-auto mb-2" />
            {csvFileName ? (
              <div>
                <p className="text-sm font-bold text-gray-900">{csvFileName}</p>
                {csvFile && <p className="text-[11px] text-gray-500">{(csvFile.size / 1024).toFixed(1)} KB</p>}
                <p className="text-xs text-blue-600 mt-1">Click to choose a different CSV file</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Select or drag & drop mass order CSV here
                </p>
                <p className="text-xs text-gray-400 mt-1">Accepts standard .csv files</p>
              </div>
            )}
          </label>

          {/* Format Helper Note */}
          <div className="p-3 bg-blue-50 border border-blue-100 text-blue-900 text-xs rounded-xl">
            <p className="font-semibold mb-1">Expected CSV Header / Format:</p>
            <code className="text-blue-800 bg-white/70 px-2 py-0.5 rounded border border-blue-200 block font-mono text-[11px]">
              service_id, link, quantity
            </code>
            <p className="text-[11px] text-blue-700 mt-1.5">
              Example: <code>101, https://instagram.com/sample, 1000</code>
            </p>
          </div>

          {/* Parsed Rows Summary & Table Preview */}
          {csvParsing ? (
            <div className="p-6 text-center text-gray-500">
              <FaSync className="animate-spin text-2xl mx-auto text-blue-600 mb-2" />
              <p className="font-semibold">Parsing CSV records...</p>
            </div>
          ) : csvParsedRows.length > 0 ? (
            <div className="space-y-3">
              {/* Counter badges */}
              <div className="flex items-center justify-between p-2.5 bg-gray-100/70 rounded-lg">
                <span className="font-semibold text-gray-700">
                  Total Parsed Rows: <strong className="text-gray-900">{csvParsedRows.length}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold text-[11px]">
                    <FaCheck className="text-[9px]" /> {csvParsedRows.filter((r) => r.isValid).length} Valid
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 font-semibold text-[11px]">
                    <FaTimes className="text-[9px]" /> {csvParsedRows.filter((r) => !r.isValid).length} Invalid
                  </span>
                </div>
              </div>

              {/* Table Preview */}
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Row</th>
                      <th className="py-2 px-3">Service</th>
                      <th className="py-2 px-3">Link</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800">
                    {csvParsedRows.slice(0, 15).map((row) => (
                      <tr key={row.rowNumber} className={row.isValid ? "hover:bg-gray-50" : "bg-rose-50/40"}>
                        <td className="py-2 px-3 font-mono text-gray-500">#{row.rowNumber}</td>
                        <td className="py-2 px-3 font-mono font-bold text-gray-900">{row.serviceId || "—"}</td>
                        <td className="py-2 px-3 truncate max-w-[180px]" title={row.link}>
                          {row.link || "—"}
                        </td>
                        <td className="py-2 px-3 font-mono">{row.quantity ? row.quantity.toLocaleString() : "—"}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <FaCheck className="text-[9px]" /> Valid
                            </span>
                          ) : (
                            <span
                              className="text-rose-600 font-semibold truncate block max-w-[140px]"
                              title={row.errors.join(", ")}
                            >
                              {row.errors[0] || "Invalid"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvParsedRows.length > 15 && (
                <p className="text-[11px] text-gray-400 text-center">
                  Showing first 15 rows of {csvParsedRows.length} total rows
                </p>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* 4. ACTION CONFIRMATION DIALOG                             */}
      {/* ========================================================= */}
      <ConfirmDialog
        isOpen={confirmAction.isOpen}
        onClose={() => setConfirmAction({ isOpen: false, order: null, action: null })}
        onConfirm={executeOrderAction}
        title={`${confirmAction.action} Order`}
        message={
          confirmAction.action === "Cancel & Refund"
            ? `Are you sure you want to cancel order ${confirmAction.order?.id} and refund ${confirmAction.order?.amount || "funds"} back to ${confirmAction.order?.user || "the customer"}'s wallet?`
            : confirmAction.action === "Refill"
            ? `Trigger upstream refill request for order ${confirmAction.order?.id} (${confirmAction.order?.service})?`
            : `Mark order ${confirmAction.order?.id} as Completed?`
        }
        confirmText={confirmAction.action === "Cancel & Refund" ? "Cancel & Refund" : confirmAction.action}
        variant={confirmAction.action === "Cancel & Refund" ? "danger" : "primary"}
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}

export default AdminOrders;
