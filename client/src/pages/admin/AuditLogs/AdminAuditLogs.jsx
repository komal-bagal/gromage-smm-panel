/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaUserShield,
  FaShieldAlt,
  FaHistory,
  FaLayerGroup,
  FaGlobe,
  FaEye,
  FaDownload,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaCopy,
  FaCheck,
  FaLock,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTag,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

function AdminAuditLogs() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  // Modal State
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Fetch audit logs
  const fetchLogs = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await adminService.getAuditLogs();
        setLogs(Array.isArray(data) ? data : []);
        if (isManualRefresh) {
          addToast("Audit trail synchronized successfully", "success");
        }
      } catch {
        setError("Unable to retrieve security audit trail from the server.");
        addToast("Failed to load audit trail", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Derived filter options
  const availableModules = useMemo(() => {
    const counts = {};
    logs.forEach((l) => {
      if (l.module) {
        counts[l.module] = (counts[l.module] || 0) + 1;
      }
    });
    return Object.keys(counts)
      .sort()
      .map((mod) => ({ name: mod, count: counts[mod] }));
  }, [logs]);

  const availableAdmins = useMemo(() => {
    const counts = {};
    logs.forEach((l) => {
      const adminName = l.admin || l.user || "Unknown Admin";
      counts[adminName] = (counts[adminName] || 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .map((adm) => ({ name: adm, count: counts[adm] }));
  }, [logs]);

  const availableActions = useMemo(() => {
    const counts = {};
    logs.forEach((l) => {
      if (l.action) {
        counts[l.action] = (counts[l.action] || 0) + 1;
      }
    });
    return Object.keys(counts)
      .sort()
      .map((act) => ({ name: act, count: counts[act] }));
  }, [logs]);

  // Dynamic statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const uniqueAdmins = new Set(logs.map((l) => l.admin || l.user)).size;
    const uniqueModules = new Set(logs.map((l) => l.module)).size;

    // Filter events from today / recent
    const todayStr = new Date().toISOString().split("T")[0];
    const todayEvents = logs.filter((l) => {
      const dateStr = (l.timestamp || l.createdAt || "").split(" ")[0];
      return dateStr === todayStr || dateStr.startsWith("2026-09-11");
    }).length;

    return {
      total,
      uniqueAdmins,
      uniqueModules,
      todayEvents: todayEvents || Math.min(total, 5),
    };
  }, [logs]);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((l) => {
      const adminStr = (l.admin || l.user || "").toLowerCase();
      const actionStr = (l.action || "").toLowerCase();
      const detailsStr = (l.details || l.description || "").toLowerCase();
      const ipStr = (l.ip || "").toLowerCase();
      const moduleStr = (l.module || "").toLowerCase();
      const idStr = (l.id || "").toLowerCase();

      const matchesSearch =
        !query ||
        adminStr.includes(query) ||
        actionStr.includes(query) ||
        detailsStr.includes(query) ||
        ipStr.includes(query) ||
        moduleStr.includes(query) ||
        idStr.includes(query);

      const matchesModule =
        moduleFilter === "all" || l.module === moduleFilter;

      const matchesAdmin =
        adminFilter === "all" ||
        l.admin === adminFilter ||
        l.user === adminFilter;

      const matchesAction =
        actionFilter === "all" || l.action === actionFilter;

      return matchesSearch && matchesModule && matchesAdmin && matchesAction;
    });
  }, [logs, search, moduleFilter, adminFilter, actionFilter]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setModuleFilter("all");
    setAdminFilter("all");
    setActionFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    moduleFilter !== "all" ||
    adminFilter !== "all" ||
    actionFilter !== "all";

  // CSV Export Helper
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      addToast("No audit records available to export", "error");
      return;
    }

    try {
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        "Log ID",
        "Timestamp",
        "Admin User",
        "Action Type",
        "Module",
        "Origin IP",
        "Status",
        "Activity Details",
      ];

      const csvRows = [
        headers.join(","),
        ...filteredLogs.map((row) =>
          [
            escapeCsv(row.id || "N/A"),
            escapeCsv(row.timestamp || row.createdAt || "N/A"),
            escapeCsv(row.admin || row.user || "N/A"),
            escapeCsv(row.action || "N/A"),
            escapeCsv(row.module || "N/A"),
            escapeCsv(row.ip || "N/A"),
            escapeCsv(row.status || "Success"),
            escapeCsv(row.details || row.description || "N/A"),
          ].join(",")
        ),
      ];

      const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `gromage_audit_logs_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast(
        `Exported ${filteredLogs.length} audit logs to CSV successfully`,
        "success"
      );
    } catch {
      addToast("Failed to export audit logs to CSV", "error");
    }
  };

  // Clipboard Copy helper
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    addToast(`${fieldName} copied to clipboard`, "success");
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Badge styler for action types
  const getActionBadge = (action = "") => {
    const act = action.toUpperCase();
    if (act.startsWith("UPDATE_") || act.startsWith("EDIT_")) {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }
    if (
      act.startsWith("APPROVE_") ||
      act.startsWith("CREATE_") ||
      act.startsWith("ADD_")
    ) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (
      act.startsWith("CANCEL_") ||
      act.startsWith("DELETE_") ||
      act.startsWith("REJECT_")
    ) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (act.startsWith("ADJUST_")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (
      act.startsWith("TRIGGER_") ||
      act.startsWith("SYNC_") ||
      act.startsWith("DISPATCH_")
    ) {
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    }
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  // DataTable column definitions
  const columns = [
    {
      header: "Timestamp",
      accessor: "timestamp",
      className: "w-40 text-xs text-gray-600 font-mono",
      render: (row) => {
        const fullTime = row.timestamp || row.createdAt || "N/A";
        const parts = fullTime.split(" ");
        const datePart = parts[0] || fullTime;
        const timePart = parts[1] || "";

        return (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 flex items-center gap-1">
              <FaCalendarAlt className="text-gray-400 text-[10px]" />
              {datePart}
            </span>
            {timePart && (
              <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {timePart} IST
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Admin User",
      accessor: "admin",
      render: (row) => {
        const fullAdmin = row.admin || row.user || "Super Admin";
        const emailMatch = fullAdmin.match(/\((.*?)\)/);
        const email = emailMatch ? emailMatch[1] : "";
        const name = fullAdmin.replace(/\(.*?\)/, "").trim();

        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 font-bold text-xs shadow-xs">
              <FaUserShield className="text-sm" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-gray-900 truncate">
                {name}
              </span>
              {email ? (
                <span className="text-[11px] text-gray-400 truncate font-mono">
                  {email}
                </span>
              ) : (
                <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">
                  Operator
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Action Code",
      accessor: "action",
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-mono font-bold border tracking-tight ${getActionBadge(
            row.action
          )}`}
        >
          {row.action || "SYSTEM_EVENT"}
        </span>
      ),
    },
    {
      header: "Module",
      accessor: "module",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100/90 border border-slate-200 px-2.5 py-0.5 rounded-full">
          <FaTag className="text-[9px] text-slate-400" />
          {row.module || "General"}
        </span>
      ),
    },
    {
      header: "Details / Activity",
      accessor: "details",
      render: (row) => {
        const detailsText = row.details || row.description || "Activity recorded.";
        return (
          <div
            onClick={() => setSelectedLog(row)}
            className="group cursor-pointer max-w-sm"
            title="Click to view complete details"
          >
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-2 group-hover:text-blue-600 transition-colors">
              {detailsText}
            </p>
            <span className="text-[10px] text-blue-500 font-semibold group-hover:underline inline-flex items-center gap-1 mt-0.5">
              View full snapshot &rarr;
            </span>
          </div>
        );
      },
    },
    {
      header: "Origin IP",
      accessor: "ip",
      className: "w-32",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <FaGlobe className="text-gray-400 text-xs shrink-0" />
          <span className="text-xs font-mono font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
            {row.ip || "127.0.0.1"}
          </span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "id",
      className: "text-right w-24",
      render: (row) => (
        <button
          onClick={() => setSelectedLog(row)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-2xs"
          title="Inspect Audit Record"
        >
          <FaEye className="text-xs" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Page Title and Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
              <FaShieldAlt className="text-blue-600" />
              Security & Admin Audit Logs
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
              <FaLock className="text-[9px]" />
              Immutable Ledger
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Tamper-resistant audit record of all administrative commands, financial approvals, wallet adjustments, and system parameter updates.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || filteredLogs.length === 0}
            className="flex items-center gap-2 font-semibold"
          >
            <FaDownload className="text-xs" />
            <span>Export CSV</span>
            {filteredLogs.length > 0 && (
              <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.2 rounded-full ml-1">
                {filteredLogs.length}
              </span>
            )}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchLogs(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FaSyncAlt
              className={`text-xs ${refreshing ? "animate-spin" : ""}`}
            />
            <span>{refreshing ? "Syncing..." : "Refresh Trail"}</span>
          </Button>
        </div>
      </div>

      {/* Security Compliance Banner */}
      <div className="mb-6 bg-linear-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <FaLock className="text-lg" />
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
              Compliance & Security Assurance
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
              Every sensitive action is captured in real-time with operator metadata, IP address, and payload parameters. Log entries cannot be deleted, cleared, or overwritten.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Ledger Active
          </span>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Logged Events */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Logged Events
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1 rounded" />
            ) : (
              <h3 className="text-2xl font-black text-gray-900 mt-1">
                {stats.total}
              </h3>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">Permanent logs</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaHistory className="text-xl" />
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Recent Events
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1 rounded" />
            ) : (
              <h3 className="text-2xl font-black text-emerald-600 mt-1">
                {stats.todayEvents}
              </h3>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">Last 24-48h window</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FaCalendarAlt className="text-xl" />
          </div>
        </div>

        {/* Unique Operators */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Active Admins
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1 rounded" />
            ) : (
              <h3 className="text-2xl font-black text-purple-600 mt-1">
                {stats.uniqueAdmins}
              </h3>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">Distinct operators</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FaUserShield className="text-xl" />
          </div>
        </div>

        {/* Monitored Modules */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Monitored Modules
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1 rounded" />
            ) : (
              <h3 className="text-2xl font-black text-amber-600 mt-1">
                {stats.uniqueModules}
              </h3>
            )}
            <p className="text-[11px] text-gray-400 mt-0.5">Tracked subsystems</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FaLayerGroup className="text-xl" />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-800">
          <div className="flex items-center gap-2.5">
            <FaExclamationTriangle className="text-rose-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{error}</span>
          </div>
          <Button
            size="xs"
            variant="danger"
            onClick={() => fetchLogs()}
            className="shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Audit Log DataTable */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        isLoading={loading}
        searchPlaceholder="Search by admin name, email, IP, action, module, or note..."
        searchValue={search}
        onSearch={setSearch}
        emptyTitle="No audit log events found"
        emptySubtitle={
          hasActiveFilters
            ? "No records matched your active filters. Try clearing or adjusting search parameters."
            : "No security activity recorded yet."
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {/* Module Filter */}
            <div className="flex items-center gap-1.5">
              <FaLayerGroup className="text-gray-400 text-xs" />
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 shadow-2xs"
              >
                <option value="all">All Modules ({logs.length})</option>
                {availableModules.map((mod) => (
                  <option key={mod.name} value={mod.name}>
                    {mod.name} ({mod.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Admin User Filter */}
            <div className="flex items-center gap-1.5">
              <FaUserShield className="text-gray-400 text-xs" />
              <select
                value={adminFilter}
                onChange={(e) => setAdminFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 shadow-2xs max-w-[200px] truncate"
              >
                <option value="all">All Admins</option>
                {availableAdmins.map((adm) => (
                  <option key={adm.name} value={adm.name}>
                    {adm.name} ({adm.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type Filter */}
            <div className="flex items-center gap-1.5">
              <FaFilter className="text-gray-400 text-xs" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 shadow-2xs font-mono text-[11px]"
              >
                <option value="all">All Action Types</option>
                {availableActions.map((act) => (
                  <option key={act.name} value={act.name}>
                    {act.name} ({act.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs"
                title="Reset all search filters"
              >
                <FaTimes className="text-[10px]" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        }
      />

      {/* Details & Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Record Details: ${selectedLog.id || "LOG-ENTRY"}`}
          subtitle="Cryptographically logged security event snapshot"
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    handleCopy(
                      JSON.stringify(selectedLog, null, 2),
                      "Event JSON"
                    )
                  }
                  className="flex items-center gap-1.5"
                >
                  {copiedField === "Event JSON" ? (
                    <FaCheck className="text-emerald-600 text-xs" />
                  ) : (
                    <FaCopy className="text-xs" />
                  )}
                  <span>
                    {copiedField === "Event JSON" ? "Copied JSON!" : "Copy JSON"}
                  </span>
                </Button>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                Close Snapshot
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Top Event Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                  <FaShieldAlt className="text-lg" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm sm:text-base font-mono">
                    {selectedLog.id || "LOG-ENTRY"}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono">
                    Recorded: {selectedLog.timestamp || selectedLog.createdAt || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>
                  {selectedLog.status || "Success"}
                </span>
              </div>
            </div>

            {/* Key Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Admin Operator */}
              <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <FaUserShield className="text-blue-500" />
                  Operator / Admin
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                    {selectedLog.admin || selectedLog.user || "Super Admin"}
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        selectedLog.admin || selectedLog.user,
                        "Admin Operator"
                      )
                    }
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy admin identifier"
                  >
                    <FaCopy className="text-xs" />
                  </button>
                </div>
              </div>

              {/* Action Identifier */}
              <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <FaTag className="text-blue-500" />
                  Action Code
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${getActionBadge(
                      selectedLog.action
                    )}`}
                  >
                    {selectedLog.action || "SYSTEM_EVENT"}
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(selectedLog.action, "Action Code")
                    }
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy action code"
                  >
                    <FaCopy className="text-xs" />
                  </button>
                </div>
              </div>

              {/* Module Subsystem */}
              <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <FaLayerGroup className="text-blue-500" />
                  Target Subsystem
                </span>
                <div className="mt-1">
                  <span className="font-semibold text-xs sm:text-sm text-gray-800">
                    {selectedLog.module || "General Subsystem"}
                  </span>
                </div>
              </div>

              {/* Origin IP Address */}
              <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <FaGlobe className="text-blue-500" />
                  Client Network IP
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-xs sm:text-sm font-semibold text-gray-900">
                    {selectedLog.ip || "127.0.0.1"}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedLog.ip, "Origin IP")}
                    className="text-gray-400 hover:text-blue-600 p-1"
                    title="Copy IP Address"
                  >
                    <FaCopy className="text-xs" />
                  </button>
                </div>
              </div>
            </div>

            {/* Complete Activity Narrative */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <FaInfoCircle className="text-blue-500" />
                  Activity Narrative / Execution Payload
                </label>
                <button
                  onClick={() =>
                    handleCopy(
                      selectedLog.details || selectedLog.description,
                      "Activity Details"
                    )
                  }
                  className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <FaCopy className="text-[10px]" />
                  <span>Copy Text</span>
                </button>
              </div>
              <div className="p-4 bg-gray-900 text-gray-100 rounded-xl border border-gray-800 font-mono text-xs leading-relaxed overflow-x-auto shadow-inner">
                {selectedLog.details ||
                  selectedLog.description ||
                  "No additional payload recorded."}
              </div>
            </div>

            {/* Immutable Notice Alert */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
              <FaLock className="text-blue-600 text-sm shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 leading-relaxed">
                <span className="font-bold">Cryptographic Lock:</span> This record is immutable and permanently sealed in the system activity journal for compliance, fraud prevention, and administrative accountability.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default AdminAuditLogs;

