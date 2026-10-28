/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaUserShield,
  FaEdit,
  FaUsers,
  FaCheckCircle,
  FaSearch,
  FaSync,
  FaSave,
  FaTimes,
  FaShieldAlt,
  FaCheckDouble,
  FaFilter,
  FaLayerGroup,
  FaServer,
  FaShoppingCart,
  FaRupeeSign,
  FaCogs,
  FaEye,
  FaExclamationTriangle,
  FaUndo,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Modal from "../../../components/ui/Modal";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

// Permission Matrix Categories & Capabilities Definition
const AVAILABLE_PERMISSIONS = [
  {
    category: "User Management",
    key: "users",
    icon: FaUsers,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    perms: [
      {
        id: "users.view",
        label: "View User Accounts",
        desc: "Browse customer accounts, view profiles, balances, and spend history",
      },
      {
        id: "users.edit",
        label: "Edit User Profiles",
        desc: "Modify email, phone, status, and custom reseller rate tiers",
      },
      {
        id: "users.wallet",
        label: "Adjust User Wallets",
        desc: "Credit or debit user wallet balances with transaction audit notes",
      },
      {
        id: "users.suspend",
        label: "Suspend Accounts",
        desc: "Block or ban customer accounts from platform access",
      },
    ],
  },
  {
    category: "Services & Catalog",
    key: "services",
    icon: FaLayerGroup,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    perms: [
      {
        id: "services.view",
        label: "View Services",
        desc: "View the complete service catalog, pricing, and category lists",
      },
      {
        id: "services.add",
        label: "Create Services",
        desc: "Add new custom SMM services and manual packages",
      },
      {
        id: "services.edit",
        label: "Edit Pricing / Min-Max",
        desc: "Change service prices, descriptions, and min/max order limits",
      },
      {
        id: "services.import",
        label: "Import from Providers",
        desc: "Bulk import new services directly from upstream provider APIs",
      },
    ],
  },
  {
    category: "Providers & APIs",
    key: "providers",
    icon: FaServer,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    perms: [
      {
        id: "providers.view",
        label: "View Providers",
        desc: "View provider balances, API endpoints, and connectivity status",
      },
      {
        id: "providers.edit",
        label: "Edit API Credentials",
        desc: "Configure provider API keys, endpoints, and authentication tokens",
      },
      {
        id: "providers.sync",
        label: "Trigger Sync Cron",
        desc: "Run manual synchronization for service catalogs and balances",
      },
    ],
  },
  {
    category: "Orders & Refills",
    key: "orders",
    icon: FaShoppingCart,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    perms: [
      {
        id: "orders.view",
        label: "View Orders",
        desc: "Browse all customer orders and live upstream provider statuses",
      },
      {
        id: "orders.manual",
        label: "Create Manual Orders",
        desc: "Dispatch manual orders directly to provider server nodes",
      },
      {
        id: "orders.refill",
        label: "Request Refills",
        desc: "Trigger warranty refill requests for dropped follower counts",
      },
      {
        id: "orders.refund",
        label: "Cancel & Refund",
        desc: "Cancel orders and refund balances back to customer wallets",
      },
    ],
  },
  {
    category: "Finance & Invoices",
    key: "finance",
    icon: FaRupeeSign,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    perms: [
      {
        id: "finance.view",
        label: "View Ledger",
        desc: "Inspect transaction ledger, payment logs, and cash flow reports",
      },
      {
        id: "finance.approve",
        label: "Approve UPI Recharges",
        desc: "Approve or reject manual QR and UTR payment deposit claims",
      },
      {
        id: "finance.invoices",
        label: "View Invoices",
        desc: "Generate, view, and export GST tax invoices and receipts",
      },
    ],
  },
  {
    category: "CMS & Platform Settings",
    key: "settings",
    icon: FaCogs,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    perms: [
      {
        id: "cms.pages",
        label: "Edit CMS Pages",
        desc: "Manage Terms, Privacy Policy, About Us, and FAQ content",
      },
      {
        id: "settings.all",
        label: "Modify System Settings",
        desc: "Change branding, SEO, payment gateway keys, and maintenance mode",
      },
      {
        id: "roles.manage",
        label: "Manage Roles & Permissions",
        desc: "Configure staff administrative roles and capability matrices",
      },
    ],
  },
];

const ALL_PERMISSION_IDS = AVAILABLE_PERMISSIONS.flatMap((group) =>
  group.perms.map((p) => p.id)
);
const TOTAL_PERMISSIONS_COUNT = ALL_PERMISSION_IDS.length;

function AdminRoles() {
  const { addToast } = useToast();

  // Roles State
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [accessFilter, setAccessFilter] = useState("all"); // 'all' | 'full' | 'custom'
  const [assignedFilter, setAssignedFilter] = useState("all"); // 'all' | 'assigned' | 'unassigned'

  // Edit Permission Matrix Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Details Modal State (Read-Only)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsRole, setDetailsRole] = useState(null);

  // Fetch Roles from Service
  const fetchRoles = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const data = await adminService.getRoles();
        setRoles(Array.isArray(data) ? data : []);
        if (isManualRefresh) {
          addToast("Roles & permission matrices reloaded", "success");
        }
      } catch (err) {
        const msg = err?.message || "Failed to load admin roles";
        setFetchError(msg);
        addToast(msg, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Derived Dynamic Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalRoles = roles.length;
    const totalAdmins = roles.reduce(
      (acc, r) => acc + (Number(r.usersAssigned || r.users) || 0),
      0
    );
    const fullAccessRoles = roles.filter(
      (r) =>
        r.permissions &&
        (r.permissions.length === TOTAL_PERMISSIONS_COUNT ||
          r.permissions.includes("*") ||
          r.permissions.includes("users.all"))
    ).length;

    const totalPermissionsGranted = roles.reduce(
      (acc, r) => acc + (Array.isArray(r.permissions) ? r.permissions.length : 0),
      0
    );
    const avgPermissions =
      totalRoles > 0 ? (totalPermissionsGranted / totalRoles).toFixed(1) : 0;

    return {
      totalRoles,
      totalAdmins,
      fullAccessRoles,
      avgPermissions,
    };
  }, [roles]);

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      // Access filter
      const hasFullAccess =
        role.permissions &&
        (role.permissions.length === TOTAL_PERMISSIONS_COUNT ||
          role.permissions.includes("*") ||
          role.permissions.includes("users.all"));

      if (accessFilter === "full" && !hasFullAccess) return false;
      if (accessFilter === "custom" && hasFullAccess) return false;

      // Assigned Staff filter
      const adminCount = Number(role.usersAssigned || role.users) || 0;
      if (assignedFilter === "assigned" && adminCount === 0) return false;
      if (assignedFilter === "unassigned" && adminCount > 0) return false;

      // Search match
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const matchesName = role.name ? role.name.toLowerCase().includes(term) : false;
        const matchesDesc = role.description
          ? role.description.toLowerCase().includes(term)
          : false;
        const matchesId = role.id ? role.id.toLowerCase().includes(term) : false;

        if (!matchesName && !matchesDesc && !matchesId) return false;
      }

      return true;
    });
  }, [roles, accessFilter, assignedFilter, searchTerm]);

  // Open Edit Modal
  const handleEditRole = (role) => {
    setSelectedRole(role);
    // Sanitize and deduplicate permissions from role
    const existing = Array.isArray(role.permissions) ? role.permissions : [];
    setRolePermissions([...new Set(existing)]);
    setEditModalOpen(true);
  };

  // Open Details Modal
  const handleViewDetails = (role) => {
    setDetailsRole(role);
    setDetailsModalOpen(true);
  };

  // Check if Modal is dirty
  const isDirty = useMemo(() => {
    if (!selectedRole || !editModalOpen) return false;
    const initialPerms = Array.isArray(selectedRole.permissions)
      ? selectedRole.permissions
      : [];
    if (rolePermissions.length !== initialPerms.length) return true;
    const setA = new Set(rolePermissions);
    return !initialPerms.every((p) => setA.has(p));
  }, [rolePermissions, selectedRole, editModalOpen]);

  // Toggle single permission
  const handleTogglePerm = (permId) => {
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  // Select all permissions in a category
  const handleSelectCategory = (categoryPerms) => {
    const idsToAdd = categoryPerms.map((p) => p.id);
    setRolePermissions((prev) => [...new Set([...prev, ...idsToAdd])]);
  };

  // Clear all permissions in a category
  const handleClearCategory = (categoryPerms) => {
    const idsToRemove = new Set(categoryPerms.map((p) => p.id));
    setRolePermissions((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  // Select all overall
  const handleSelectAll = () => {
    setRolePermissions([...ALL_PERMISSION_IDS]);
  };

  // Clear all overall
  const handleClearAll = () => {
    setRolePermissions([]);
  };

  // Close modal with dirty check
  const requestCloseEditModal = () => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      setEditModalOpen(false);
      setSelectedRole(null);
    }
  };

  const forceCloseEditModal = () => {
    setConfirmDiscardOpen(false);
    setEditModalOpen(false);
    setSelectedRole(null);
  };

  // Save Role Permissions
  const handleSaveRole = async () => {
    if (!selectedRole) return;

    // Filter to valid IDs and deduplicate
    const sanitized = [
      ...new Set(rolePermissions.filter((id) => ALL_PERMISSION_IDS.includes(id))),
    ];

    setIsSaving(true);
    try {
      const response = await adminService.updateRole(selectedRole.id, {
        permissions: sanitized,
      });

      if (response && response.success === false) {
        throw new Error(response.message || "Failed to update role");
      }

      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRole.id ? { ...r, permissions: sanitized } : r
        )
      );

      addToast(`Permissions updated for '${selectedRole.name}'`, "success");
      setEditModalOpen(false);
      setSelectedRole(null);
    } catch (err) {
      const msg = err?.message || "Failed to save role permissions";
      addToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: check which categories are covered by a role
  const getCoveredCategories = (rolePerms = []) => {
    const permSet = new Set(rolePerms);
    return AVAILABLE_PERMISSIONS.filter((group) =>
      group.perms.some((p) => permSet.has(p.id))
    );
  };

  // Table Columns Definition
  const columns = [
    {
      header: "Role Name & Purpose",
      accessor: "name",
      render: (row) => (
        <div className="py-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <FaUserShield className="text-blue-600" />
              {row.name}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
              {row.id}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {row.description || "No description provided"}
          </p>
        </div>
      ),
    },
    {
      header: "Active Admins",
      accessor: "usersAssigned",
      render: (row) => {
        const count = Number(row.usersAssigned || row.users) || 0;
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              count > 0
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            <FaUsers className="text-[11px]" />
            {count} {count === 1 ? "Staff Admin" : "Staff Admins"}
          </span>
        );
      },
    },
    {
      header: "Access Level",
      accessor: "permissions",
      render: (row) => {
        const perms = Array.isArray(row.permissions) ? row.permissions : [];
        const isFull = perms.length >= TOTAL_PERMISSIONS_COUNT;

        return (
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isFull
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                }`}
              >
                {isFull ? "Full System Access" : `${perms.length} / ${TOTAL_PERMISSIONS_COUNT} Capabilities`}
              </span>
            </div>

            {/* Visual Mini Category Tag Previews */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {getCoveredCategories(perms).map((c) => (
                <span
                  key={c.key}
                  className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200"
                  title={`${c.category} Access`}
                >
                  {c.category.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => handleViewDetails(row)}
            icon={<FaEye className="text-gray-500" />}
            aria-label={`View ${row.name} details`}
          >
            View
          </Button>

          <Button
            size="xs"
            variant="outline"
            onClick={() => handleEditRole(row)}
            icon={<FaEdit className="text-blue-600" />}
            aria-label={`Edit ${row.name} permissions`}
          >
            Edit Matrix
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Page Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Roles & Permission Matrix
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Access Control
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Control administrative user privileges and configure granular capability matrices
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRoles(true)}
            isLoading={refreshing}
            disabled={loading || refreshing}
            icon={
              <FaSync
                className={refreshing ? "animate-spin text-blue-600" : "text-gray-600"}
              />
            }
          >
            Refresh Roles
          </Button>
        </div>
      </div>

      {/* Security Architecture Notice */}
      <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 rounded-xl mb-6 flex items-start sm:items-center gap-3.5 text-xs text-blue-950 shadow-xs">
        <div className="p-2 rounded-lg bg-blue-100/80 text-blue-700 shrink-0 mt-0.5 sm:mt-0">
          <FaShieldAlt className="text-lg" />
        </div>
        <div className="flex-1 leading-relaxed">
          <strong className="font-semibold text-blue-900">Role-Based Access Architecture:</strong>{" "}
          Permission matrices define the authorization boundaries for administrative staff. Changes take effect on subsequent requests and are enforced by backend security middleware upon API integration.
        </div>
      </div>

      {/* Error / Retry Banner */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6 flex items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-center gap-2.5">
            <FaExclamationTriangle className="text-rose-600 text-base shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button size="xs" variant="outline" onClick={() => fetchRoles(false)}>
            Retry Loading
          </Button>
        </div>
      )}

      {/* Dynamic Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Roles */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <FaUserShield />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Roles
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-gray-900">
                  {summaryMetrics.totalRoles}
                </span>
                <span className="text-[11px] text-gray-400">Defined Roles</span>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Staff Admins */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
            <FaUsers />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Assigned Staff
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-indigo-600">
                  {summaryMetrics.totalAdmins}
                </span>
                <span className="text-[11px] text-gray-400">Active Admins</span>
              </div>
            )}
          </div>
        </div>

        {/* Full Access Roles */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <FaCheckCircle />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Full Access Roles
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-emerald-600">
                  {summaryMetrics.fullAccessRoles}
                </span>
                <span className="text-[11px] text-gray-400">Unrestricted</span>
              </div>
            )}
          </div>
        </div>

        {/* Average Capabilities */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">
            <FaCogs />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Avg Capabilities
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-purple-600">
                  {summaryMetrics.avgPermissions}
                </span>
                <span className="text-[11px] text-gray-400">
                  of {TOTAL_PERMISSIONS_COUNT} Max
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roles by name, identifier, or description..."
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
          {/* Access Level Filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <FaFilter className="text-gray-400 text-[10px]" />
            <span className="font-semibold hidden sm:inline">Access:</span>
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Access Levels ({roles.length})</option>
              <option value="full">Full Access ({summaryMetrics.fullAccessRoles})</option>
              <option value="custom">
                Custom Access ({summaryMetrics.totalRoles - summaryMetrics.fullAccessRoles})
              </option>
            </select>
          </div>

          {/* Assigned Staff Filter */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="font-semibold hidden sm:inline">Staff:</span>
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-2.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="assigned">Has Assigned Staff (&gt;0)</option>
              <option value="unassigned">Unassigned (0)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchTerm || accessFilter !== "all" || assignedFilter !== "all") && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setAccessFilter("all");
                setAssignedFilter("all");
              }}
              icon={<FaUndo className="text-rose-500" />}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Roles DataTable */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredRoles}
          isLoading={loading}
          searchable={false}
          emptyTitle={
            searchTerm || accessFilter !== "all" || assignedFilter !== "all"
              ? "No matching roles found"
              : "No roles configured"
          }
          emptySubtitle={
            searchTerm || accessFilter !== "all" || assignedFilter !== "all"
              ? "Try adjusting your search query or filter options."
              : "No administrative roles have been created in the system."
          }
        />
      </div>

      {/* MODAL 1: Edit Permission Matrix Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={requestCloseEditModal}
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span>Edit Permissions: {selectedRole?.name}</span>
            {isDirty && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                ● Unsaved Changes
              </span>
            )}
          </div>
        }
        size="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-gray-500 hidden sm:flex items-center gap-1.5">
              <FaShieldAlt className="text-gray-400" />
              <span>
                {rolePermissions.length} of {TOTAL_PERMISSIONS_COUNT} capabilities granted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={requestCloseEditModal}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveRole}
                isLoading={isSaving}
                icon={<FaSave />}
              >
                Save Permissions
              </Button>
            </div>
          </div>
        }
      >
        {selectedRole && (
          <div className="space-y-6">
            {/* Modal Role Header Card */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold shrink-0">
                  <FaUserShield />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">
                      {selectedRole.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-gray-600 border border-gray-200">
                      {selectedRole.id}
                    </span>
                  </div>
                  <p className="text-gray-500 mt-0.5">{selectedRole.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="font-bold text-sm text-blue-700">
                  {rolePermissions.length} / {TOTAL_PERMISSIONS_COUNT}
                </span>
                <span className="text-gray-400 text-[11px]">Selected</span>
              </div>
            </div>

            {/* Quick Bulk Selection Controls Toolbar */}
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-blue-900 font-medium">
                <FaCheckDouble className="text-blue-600" />
                <span>Bulk Selection Controls:</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleSelectAll}
                  icon={<FaCheckDouble className="text-emerald-600" />}
                >
                  Select All ({TOTAL_PERMISSIONS_COUNT})
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleClearAll}
                  icon={<FaTimes className="text-rose-500" />}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Category Groups Matrix */}
            <div className="space-y-6">
              {AVAILABLE_PERMISSIONS.map((group) => {
                const CategoryIcon = group.icon;
                const categoryPermIds = group.perms.map((p) => p.id);
                const selectedInCategory = categoryPermIds.filter((id) =>
                  rolePermissions.includes(id)
                ).length;
                const allSelected = selectedInCategory === group.perms.length;

                return (
                  <div
                    key={group.key}
                    className="border border-gray-200 rounded-xl p-4 bg-white shadow-xs space-y-3"
                  >
                    {/* Category Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${group.color}`}
                        >
                          <CategoryIcon />
                        </div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-gray-900">
                          {group.category}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            selectedInCategory > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {selectedInCategory} / {group.perms.length} Granted
                        </span>
                      </div>

                      {/* Category Action Buttons */}
                      <div className="flex items-center gap-1.5 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleSelectCategory(group.perms)}
                          disabled={allSelected}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-0.5 rounded hover:bg-blue-50 transition"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleClearCategory(group.perms)}
                          disabled={selectedInCategory === 0}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-0.5 rounded hover:bg-rose-50 transition"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {group.perms.map((p) => {
                        const isChecked = rolePermissions.includes(p.id);

                        return (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                              isChecked
                                ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-400/50 shadow-xs"
                                : "bg-gray-50/50 border-gray-200 hover:bg-gray-100/70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePerm(p.id)}
                              className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-gray-900 truncate">
                                  {p.label}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400">
                                  {p.id}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                                {p.desc}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Role Details Overview (Read-Only) */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Role Details: ${detailsRole?.name}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailsModalOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleEditRole(detailsRole);
              }}
              icon={<FaEdit />}
            >
              Edit This Matrix
            </Button>
          </div>
        }
      >
        {detailsRole && (
          <div className="space-y-5">
            {/* Header summary */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaUserShield className="text-blue-600 text-lg" />
                  <span className="font-bold text-base text-gray-900">
                    {detailsRole.name}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                    {detailsRole.id}
                  </span>
                </div>
                <Badge
                  status={
                    detailsRole.permissions?.length >= TOTAL_PERMISSIONS_COUNT
                      ? "Active"
                      : "Pending"
                  }
                  size="sm"
                >
                  {detailsRole.permissions?.length >= TOTAL_PERMISSIONS_COUNT
                    ? "Full Access"
                    : `${detailsRole.permissions?.length} Capabilities`}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {detailsRole.description}
              </p>
              <div className="pt-2 border-t border-gray-200/60 flex items-center gap-4 text-xs text-gray-500">
                <span>
                  <strong>Assigned Staff:</strong>{" "}
                  {detailsRole.usersAssigned || detailsRole.users || 0} Admins
                </span>
                <span>•</span>
                <span>
                  <strong>Capabilities:</strong>{" "}
                  {detailsRole.permissions?.length || 0} of {TOTAL_PERMISSIONS_COUNT} Total
                </span>
              </div>
            </div>

            {/* Breakdown by Category */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Granted Capabilities Breakdown
              </h4>

              {AVAILABLE_PERMISSIONS.map((group) => {
                const CategoryIcon = group.icon;
                const grantedPerms = group.perms.filter((p) =>
                  (detailsRole.permissions || []).includes(p.id)
                );

                return (
                  <div
                    key={group.key}
                    className="border border-gray-200 rounded-xl p-3.5 bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${group.color}`}
                        >
                          <CategoryIcon />
                        </div>
                        <span>{group.category}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-gray-600">
                        {grantedPerms.length} of {group.perms.length} Granted
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {group.perms.map((p) => {
                        const isGranted = (detailsRole.permissions || []).includes(
                          p.id
                        );

                        return (
                          <div
                            key={p.id}
                            className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                              isGranted
                                ? "bg-emerald-50/50 border-emerald-200 text-emerald-950 font-medium"
                                : "bg-gray-50/50 border-gray-200 text-gray-400 opacity-60"
                            }`}
                          >
                            <span className="mt-0.5 text-xs">
                              {isGranted ? (
                                <FaCheckCircle className="text-emerald-600" />
                              ) : (
                                <FaTimes className="text-gray-300" />
                              )}
                            </span>
                            <div>
                              <div className="font-semibold">{p.label}</div>
                              <div className="text-[10px] font-mono text-gray-500">
                                {p.id}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Discard Modal */}
      <ConfirmDialog
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={forceCloseEditModal}
        title="Discard Unsaved Permission Changes?"
        message="You have unsaved changes in this role permission matrix. Are you sure you want to discard your changes?"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        variant="danger"
      />
    </AdminLayout>
  );
}

export default AdminRoles;

