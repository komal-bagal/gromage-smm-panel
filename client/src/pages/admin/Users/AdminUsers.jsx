/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaPlus,
  FaEdit,
  FaWallet,
  FaBan,
  FaCheck,
  FaEye,
  FaUsers,
  FaUserCheck,
  FaUserSlash,
  FaMoneyBillWave,
  FaSync,
  FaExclamationTriangle,
  FaTimes,
  FaSlidersH,
  FaKey,
  FaPercent,
  FaBolt,
  FaShieldAlt,
  FaStore,
  FaCopy,
  FaSignInAlt,
  FaHistory,
  FaDesktop,
  FaMobileAlt,
  FaGlobe,
  FaUserSecret,
  FaInfoCircle,
  FaSearch,
  FaTrashAlt,
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

const ROLE_OPTIONS = [
  "Customer",
  "Reseller",
  "API Client",
  "Support Executive",
  "Finance Executive",
  "Admin",
  "Super Admin",
];

function AdminUsers() {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search, Filters & Pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal States
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsModalTab, setDetailsModalTab] = useState("overview"); // "overview" | "activity"
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [resellerModalOpen, setResellerModalOpen] = useState(false);

  // User Activity Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [activityStatusFilter, setActivityStatusFilter] = useState("all");

  // Admin Impersonation Simulation State
  const [activeImpersonation, setActiveImpersonation] = useState(null);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: "status", // "status" | "api_toggle" | "api_regen" | "login_as_user"
    user: null,
    targetValue: null,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "danger",
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Form States
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Customer",
    balance: "0",
    status: "Active",
    markup: "10",
    apiEnabled: true,
    rateLimit: "120",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Customer",
    status: "Active",
    markup: "10",
    apiEnabled: true,
    rateLimit: "120",
  });

  const [walletForm, setWalletForm] = useState({
    type: "credit",
    amount: "",
    reason: "",
    reference: "",
  });

  const [resellerForm, setResellerForm] = useState({
    markup: "10",
    apiEnabled: true,
    rateLimit: "120",
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /*
   * Fetch users from service layer
   */
  const fetchUsers = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const data = await adminService.getUsers();
        setUsers(Array.isArray(data) ? data : []);
        if (isManualRefresh) {
          addToast("User accounts refreshed successfully", "success");
        }
      } catch {
        setFetchError("Failed to fetch users list. Please try again.");
        addToast("Failed to fetch users list", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Derived filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.id?.toLowerCase().includes(term) ||
        u.phone?.toLowerCase().includes(term);

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // General Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "Active").length;
    const suspended = users.filter((u) => u.status === "Suspended").length;
    const totalBalance = users.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);
    return { total, active, suspended, totalBalance };
  }, [users]);

  // Reseller-Specific Telemetry Metrics (derived from actual data)
  const resellerMetrics = useMemo(() => {
    const resellers = users.filter((u) => u.role === "Reseller");
    const count = resellers.length;
    const active = resellers.filter((u) => u.status === "Active").length;
    const suspended = resellers.filter((u) => u.status === "Suspended").length;
    const apiEnabled = resellers.filter((u) => Boolean(u.apiEnabled)).length;
    const totalOrders = resellers.reduce(
      (acc, u) => acc + (Number(u.resellerOrdersCount || u.ordersCount) || 0),
      0
    );
    const totalEarnings = resellers.reduce(
      (acc, u) => acc + (Number(u.resellerEarnings) || 0),
      0
    );
    const avgMarkup =
      count > 0
        ? (resellers.reduce((acc, u) => acc + (Number(u.markup) || 0), 0) / count).toFixed(1)
        : "0";

    return {
      count,
      active,
      suspended,
      apiEnabled,
      totalOrders,
      totalEarnings,
      avgMarkup,
    };
  }, [users]);

  // Fetch user specific activity logs
  const fetchUserActivity = useCallback(
    async (userId) => {
      if (!userId) return;
      setActivityLoading(true);
      try {
        const logs = await adminService.getUserActivityLogs(userId);
        setActivityLogs(Array.isArray(logs) ? logs : []);
      } catch (err) {
        console.error("Failed to fetch user activity logs:", err);
        addToast("Failed to fetch user activity logs", "error");
      } finally {
        setActivityLoading(false);
      }
    },
    [addToast]
  );

  // Profile View Handler with tab support
  const handleViewProfile = (user, initialTab = "overview") => {
    setSelectedUser(user);
    setDetailsModalTab(initialTab);
    setActivitySearch("");
    setActivityTypeFilter("all");
    setActivityStatusFilter("all");
    setDetailsModalOpen(true);
    fetchUserActivity(user.id);
  };

  // Add User Handlers
  const handleAddOpen = () => {
    setAddForm({
      name: "",
      email: "",
      phone: "",
      role: roleFilter === "Reseller" ? "Reseller" : "Customer",
      balance: "0",
      status: "Active",
      markup: "10",
      apiEnabled: true,
      rateLimit: "120",
    });
    setFormErrors({});
    setAddModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!addForm.name.trim()) errors.name = "Full name is required";
    if (!addForm.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(addForm.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (isNaN(Number(addForm.balance)) || Number(addForm.balance) < 0) {
      errors.balance = "Initial balance cannot be negative";
    }

    if (addForm.role === "Reseller") {
      if (
        addForm.markup === "" ||
        isNaN(Number(addForm.markup)) ||
        Number(addForm.markup) < 0 ||
        Number(addForm.markup) > 200
      ) {
        errors.markup = "Markup must be a percentage between 0% and 200%";
      }
      if (
        addForm.rateLimit === "" ||
        isNaN(Number(addForm.rateLimit)) ||
        Number(addForm.rateLimit) < 10 ||
        Number(addForm.rateLimit) > 1000
      ) {
        errors.rateLimit = "Rate limit must be between 10 and 1000 requests/min";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...addForm,
        balance: Number(addForm.balance) || 0,
        ...(addForm.role === "Reseller" && {
          markup: Number(addForm.markup) || 10,
          apiEnabled: Boolean(addForm.apiEnabled),
          rateLimit: Number(addForm.rateLimit) || 120,
        }),
      };

      const created = await adminService.createUser(payload);
      setUsers((prev) => [created, ...prev]);
      addToast(
        `${created.role === "Reseller" ? "Reseller" : "User"} ${created.name} created successfully`,
        "success"
      );
      setAddModalOpen(false);
    } catch {
      addToast("Failed to create user account", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit User Handlers
  const handleEditOpen = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "Customer",
      status: user.status || "Active",
      markup: user.markup !== undefined ? String(user.markup) : "10",
      apiEnabled: user.apiEnabled !== undefined ? Boolean(user.apiEnabled) : true,
      rateLimit: user.rateLimit !== undefined ? String(user.rateLimit) : "120",
    });
    setFormErrors({});
    setEditModalOpen(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editForm.name.trim()) errors.name = "Full name is required";
    if (!editForm.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(editForm.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (editForm.role === "Reseller") {
      if (
        editForm.markup === "" ||
        isNaN(Number(editForm.markup)) ||
        Number(editForm.markup) < 0 ||
        Number(editForm.markup) > 200
      ) {
        errors.markup = "Markup must be a percentage between 0% and 200%";
      }
      if (
        editForm.rateLimit === "" ||
        isNaN(Number(editForm.rateLimit)) ||
        Number(editForm.rateLimit) < 10 ||
        Number(editForm.rateLimit) > 1000
      ) {
        errors.rateLimit = "Rate limit must be between 10 and 1000 requests/min";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        status: editForm.status,
        ...(editForm.role === "Reseller" && {
          markup: Number(editForm.markup) || 10,
          apiEnabled: Boolean(editForm.apiEnabled),
          rateLimit: Number(editForm.rateLimit) || 120,
        }),
      };

      const updated = await adminService.updateUser(selectedUser.id, payload);
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, ...updated } : u))
      );
      if (selectedUser?.id === updated.id) {
        setSelectedUser((prev) => ({ ...prev, ...updated }));
      }
      addToast("User profile updated successfully", "success");
      setEditModalOpen(false);
    } catch {
      addToast("Failed to update user profile", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dedicated Reseller Operations Modal Handler
  const handleOpenResellerConfig = (user) => {
    setSelectedUser(user);
    setResellerForm({
      markup: user.markup !== undefined ? String(user.markup) : "10",
      apiEnabled: user.apiEnabled !== undefined ? Boolean(user.apiEnabled) : false,
      rateLimit: user.rateLimit !== undefined ? String(user.rateLimit) : "120",
    });
    setFormErrors({});
    setResellerModalOpen(true);
  };

  const handleSaveResellerConfig = async (e) => {
    e.preventDefault();
    const errors = {};
    const numMarkup = Number(resellerForm.markup);
    const numRateLimit = Number(resellerForm.rateLimit);

    if (
      resellerForm.markup === "" ||
      isNaN(numMarkup) ||
      numMarkup < 0 ||
      numMarkup > 200
    ) {
      errors.markup = "Markup must be a non-negative percentage (0% – 200%)";
    }

    if (
      resellerForm.rateLimit === "" ||
      isNaN(numRateLimit) ||
      numRateLimit < 10 ||
      numRateLimit > 1000
    ) {
      errors.rateLimit = "Rate limit must be between 10 and 1000 requests/minute";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await adminService.updateUser(selectedUser.id, {
        markup: numMarkup,
        apiEnabled: Boolean(resellerForm.apiEnabled),
        rateLimit: numRateLimit,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, ...updated } : u))
      );
      setSelectedUser((prev) => (prev ? { ...prev, ...updated } : null));

      addToast(
        `Reseller settings for ${selectedUser.name} updated successfully`,
        "success"
      );
      setResellerModalOpen(false);
    } catch {
      addToast("Failed to update reseller settings", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // API Toggle Action (with confirmation when disabling)
  const handleToggleResellerApi = (user) => {
    const nextState = !user.apiEnabled;
    if (!nextState) {
      // Confirm disabling
      setConfirmDialog({
        isOpen: true,
        type: "api_toggle",
        user,
        targetValue: false,
        title: "Disable Reseller API Access",
        message: `Are you sure you want to disable API access for reseller ${user.name}? Downstream storefronts and automated bot integrations using this reseller's API key will be blocked immediately.`,
        confirmText: "Disable API",
        variant: "danger",
      });
    } else {
      // Direct enable
      executeToggleApi(user, true);
    }
  };

  const executeToggleApi = async (user, enabled) => {
    setIsSubmitting(true);
    try {
      const res = await adminService.toggleResellerApi(user.id, enabled);
      const updatedUser = res.user || { ...user, apiEnabled: enabled };

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updatedUser } : u))
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
      }
      addToast(
        `Reseller API access ${enabled ? "enabled" : "disabled"} for ${user.name}`,
        "success"
      );
    } catch {
      addToast("Failed to toggle reseller API access", "error");
    } finally {
      setIsSubmitting(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // API Key Regeneration Action
  const handleRegenerateApiKey = (user) => {
    setConfirmDialog({
      isOpen: true,
      type: "api_regen",
      user,
      targetValue: null,
      title: "Regenerate Reseller API Key",
      message: `Regenerating the API key for ${user.name} will immediately invalidate their current active key. Any automated scripts or reseller storefronts currently using the old key will fail until updated.`,
      confirmText: "Regenerate Key",
      variant: "danger",
    });
  };

  const executeRegenerateKey = async (user) => {
    setIsSubmitting(true);
    try {
      const res = await adminService.regenerateResellerApiKey(user.id);
      const updatedUser = res.user || {
        ...user,
        apiKey: res.apiKey,
        apiKeyLastGenerated: res.apiKeyLastGenerated,
      };

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updatedUser } : u))
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
      }

      addToast(
        `New API key generated for ${user.name}. Previous key invalidated.`,
        "success"
      );
    } catch {
      addToast("Failed to regenerate API key", "error");
    } finally {
      setIsSubmitting(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Wallet Adjustment Handlers
  const handleWalletOpen = (user) => {
    setSelectedUser(user);
    setWalletForm({
      type: "credit",
      amount: "",
      reason: "",
      reference: "",
    });
    setFormErrors({});
    setWalletModalOpen(true);
  };

  const handleWalletSubmit = async (e) => {
    e.preventDefault();
    const numAmount = Number(walletForm.amount);
    const errors = {};

    if (!walletForm.amount || isNaN(numAmount) || numAmount <= 0) {
      errors.amount = "Please enter a valid amount greater than ₹0";
    } else if (walletForm.type === "debit" && numAmount > (selectedUser?.balance || 0)) {
      errors.amount = `Cannot debit more than current balance (₹${selectedUser?.balance?.toFixed(2)})`;
    }

    if (!walletForm.reason.trim()) {
      errors.reason = "Reason or note is required for audit trail";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminService.adjustWallet(selectedUser.id, walletForm);
      const newBalance =
        res.balance !== undefined
          ? res.balance
          : walletForm.type === "credit"
          ? (selectedUser.balance || 0) + numAmount
          : Math.max(0, (selectedUser.balance || 0) - numAmount);

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id ? { ...u, balance: newBalance } : u
        )
      );

      if (selectedUser?.id === selectedUser.id) {
        setSelectedUser((prev) =>
          prev ? { ...prev, balance: newBalance } : null
        );
      }

      addToast(
        `Wallet ${walletForm.type === "credit" ? "credited" : "debited"} by ₹${numAmount.toFixed(2)} successfully`,
        "success"
      );
      setWalletModalOpen(false);
    } catch {
      addToast("Wallet adjustment failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Suspend / Activate
  const handleToggleStatus = (user) => {
    const nextStatus = user.status === "Active" ? "Suspended" : "Active";
    const isReseller = user.role === "Reseller";

    setConfirmDialog({
      isOpen: true,
      type: "status",
      user,
      targetValue: nextStatus,
      title: `${nextStatus} ${isReseller ? "Reseller" : "User"} Account`,
      message:
        nextStatus === "Suspended"
          ? `Are you sure you want to suspend ${user.name}? ${
              isReseller
                ? "Suspension halts storefront access, order processing, and all API webhook requests immediately."
                : "Suspended users cannot place orders or recharge wallets."
            }`
          : `Activate ${user.name}? Full access to panel features${
              isReseller ? " and API ordering" : ""
            } will be restored.`,
      confirmText: nextStatus,
      variant: nextStatus === "Suspended" ? "danger" : "success",
    });
  };

  const executeStatusChange = async () => {
    const { user, targetValue } = confirmDialog;
    if (!user || !targetValue) return;

    setIsSubmitting(true);
    try {
      await adminService.updateUserStatus(user.id, targetValue);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: targetValue } : u))
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser((prev) =>
          prev ? { ...prev, status: targetValue } : null
        );
      }
      addToast(
        `${user.role === "Reseller" ? "Reseller" : "User"} ${user.name} is now ${targetValue.toLowerCase()}`,
        "success"
      );
    } catch {
      addToast("Failed to update user status", "error");
    } finally {
      setIsSubmitting(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Login as User (Admin Impersonation Simulation)
  const handleLoginAsUser = (user) => {
    setConfirmDialog({
      isOpen: true,
      type: "login_as_user",
      user,
      targetValue: null,
      title: "Login as User (Admin Impersonation)",
      message: `You are about to simulate an administrative login session as ${user.name} (${user.email} • ID: ${user.id}). All actions performed during impersonation will be tracked in the security audit logs. This is a frontend simulation until backend impersonation APIs are connected.`,
      confirmText: "Login as User",
      variant: "warning",
    });
  };

  const executeLoginAsUser = async (user) => {
    setIsSubmitting(true);
    try {
      const res = await adminService.loginAsUser(user.id);
      if (res.success) {
        setActiveImpersonation({
          user: res.user,
          sessionId: res.simulatedSessionId,
          startedAt: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        });
        addToast(
          `[Admin Impersonation] Switched to simulated session for ${user.name}. Ready for backend SSO/auth integration.`,
          "info"
        );
        if (detailsModalOpen) {
          setDetailsModalOpen(false);
        }
      } else {
        addToast(res.message || "Failed to simulate user login", "error");
      }
    } catch {
      addToast("Failed to simulate user login", "error");
    } finally {
      setIsSubmitting(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Delete User Action (DELETE /api/user/:userId)
  const handleDeleteUser = (user) => {
    setConfirmDialog({
      isOpen: true,
      type: "delete_user",
      user,
      targetValue: null,
      title: `Delete Account: ${user.name}`,
      message: `Are you sure you want to delete user account ${user.name} (${user.email} • ID: ${user.id})? This will send DELETE /api/user/${user.id}. This action is permanent.`,
      confirmText: "Delete User",
      variant: "danger",
    });
  };

  const executeDeleteUser = async (user) => {
    setIsSubmitting(true);
    try {
      await adminService.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (detailsModalOpen && selectedUser?.id === user.id) {
        setDetailsModalOpen(false);
      }
      addToast(`User ${user.name} deleted successfully`, "success");
    } catch {
      addToast("Failed to delete user account", "error");
    } finally {
      setIsSubmitting(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Handle Generic Confirm Dialog Execution
  const handleConfirmAction = () => {
    if (confirmDialog.type === "status") {
      executeStatusChange();
    } else if (confirmDialog.type === "api_toggle") {
      executeToggleApi(confirmDialog.user, confirmDialog.targetValue);
    } else if (confirmDialog.type === "api_regen") {
      executeRegenerateKey(confirmDialog.user);
    } else if (confirmDialog.type === "login_as_user") {
      executeLoginAsUser(confirmDialog.user);
    } else if (confirmDialog.type === "delete_user") {
      executeDeleteUser(confirmDialog.user);
    }
  };

  // Filtered Activity Logs Memo
  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const term = activitySearch.trim().toLowerCase();
      const matchesSearch =
        !term ||
        log.description?.toLowerCase().includes(term) ||
        log.action?.toLowerCase().includes(term) ||
        log.ip?.toLowerCase().includes(term) ||
        log.device?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term);

      const matchesType =
        activityTypeFilter === "all" || log.type === activityTypeFilter;
      const matchesStatus =
        activityStatusFilter === "all" || log.status === activityStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [activityLogs, activitySearch, activityTypeFilter, activityStatusFilter]);

  // Helper to format activity type badges and icons
  const getActivityTypeInfo = (type) => {
    switch (type) {
      case "LOGIN":
        return {
          icon: <FaSignInAlt className="text-blue-600" />,
          bgColor: "bg-blue-50 text-blue-700 border-blue-200",
          label: "Login Session",
        };
      case "LOGIN_FAILED":
        return {
          icon: <FaShieldAlt className="text-rose-600" />,
          bgColor: "bg-rose-50 text-rose-700 border-rose-200",
          label: "Failed Auth",
        };
      case "ORDER_PLACED":
        return {
          icon: <FaBolt className="text-emerald-600" />,
          bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          label: "Order Placed",
        };
      case "WALLET_RECHARGE":
        return {
          icon: <FaWallet className="text-emerald-600" />,
          bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          label: "Wallet Top-up",
        };
      case "SECURITY":
        return {
          icon: <FaShieldAlt className="text-purple-600" />,
          bgColor: "bg-purple-50 text-purple-700 border-purple-200",
          label: "Security & Creds",
        };
      case "API_ACCESS":
        return {
          icon: <FaKey className="text-indigo-600" />,
          bgColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
          label: "Reseller API",
        };
      case "PROFILE_UPDATE":
        return {
          icon: <FaUserCheck className="text-amber-600" />,
          bgColor: "bg-amber-50 text-amber-700 border-amber-200",
          label: "Profile Updated",
        };
      case "TICKET_CREATED":
        return {
          icon: <FaInfoCircle className="text-teal-600" />,
          bgColor: "bg-teal-50 text-teal-700 border-teal-200",
          label: "Support Ticket",
        };
      case "STATUS_CHANGE":
        return {
          icon: <FaBan className="text-rose-600" />,
          bgColor: "bg-rose-50 text-rose-700 border-rose-200",
          label: "Status Changed",
        };
      default:
        return {
          icon: <FaHistory className="text-gray-600" />,
          bgColor: "bg-gray-50 text-gray-700 border-gray-200",
          label: type || "Activity",
        };
    }
  };

  // Filter & Search Handlers
  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleRoleChange = (val) => {
    setRoleFilter(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" || roleFilter !== "all" || statusFilter !== "all";

  // Safe copy to clipboard for masked keys/IDs
  const handleCopyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    addToast("Copied to clipboard", "success");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Table Columns Definition
  const columns = [
    {
      header: "User ID",
      accessor: "id",
      className: "font-mono font-semibold text-xs text-blue-600 w-28",
      render: (row) => (
        <button
          type="button"
          onClick={() => handleViewProfile(row)}
          className="font-mono font-semibold text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
        >
          {row.role === "Reseller" && (
            <FaStore className="text-[10px] text-indigo-500" title="Reseller Account" />
          )}
          <span>{row.id}</span>
        </button>
      ),
    },
    {
      header: "Name & Contact",
      accessor: "name",
      render: (row) => {
        const initials = row.name
          ? row.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()
          : "U";
        const isReseller = row.role === "Reseller";

        return (
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                isReseller
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  onClick={() => handleViewProfile(row)}
                  className="font-semibold text-gray-900 text-sm hover:text-blue-600 cursor-pointer truncate"
                >
                  {row.name}
                </p>
                {isReseller && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                    Reseller
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{row.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: "Role / Segment",
      accessor: "role",
      render: (row) => {
        const isReseller = row.role === "Reseller";
        const roleColors = {
          Customer: "bg-slate-100 text-slate-700 border-slate-200",
          Reseller: "bg-indigo-50 text-indigo-700 border-indigo-200",
          "API Client": "bg-purple-50 text-purple-700 border-purple-200",
          "Support Executive": "bg-teal-50 text-teal-700 border-teal-200",
          "Finance Executive": "bg-amber-50 text-amber-700 border-amber-200",
          Admin: "bg-blue-50 text-blue-700 border-blue-200",
          "Super Admin": "bg-rose-50 text-rose-700 border-rose-200",
        };
        const colorClass =
          roleColors[row.role] || "bg-gray-100 text-gray-700 border-gray-200";

        return (
          <div className="flex flex-col gap-1 items-start">
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${colorClass}`}
            >
              {row.role}
            </span>
            {isReseller && (
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                  +{row.markup ?? 10}% markup
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                    row.apiEnabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {row.apiEnabled ? "API On" : "API Off"}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: "Balance",
      accessor: "balance",
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-sm text-gray-900">
          ₹
          {(Number(row.balance) || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      header: "Orders / Vol",
      accessor: "ordersCount",
      sortable: true,
      render: (row) => {
        const isReseller = row.role === "Reseller";
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full inline-block w-fit">
              {row.ordersCount || 0} orders
            </span>
            {isReseller && row.resellerEarnings !== undefined && (
              <span className="text-[11px] text-emerald-700 font-mono font-semibold mt-0.5">
                Earned: ₹{Number(row.resellerEarnings).toFixed(2)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => <Badge status={row.status} size="xs" />,
    },
    {
      header: "Joined",
      accessor: "createdAt",
      className: "text-xs text-gray-500",
      render: (row) => <span>{row.createdAt || "—"}</span>,
    },
    {
      header: "Actions",
      accessor: "actions",
      className: "text-right",
      render: (row) => {
        const isReseller = row.role === "Reseller";
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="xs"
              variant="ghost"
              title="View Account Details"
              onClick={() => handleViewProfile(row, "overview")}
              icon={<FaEye className="text-gray-600 hover:text-gray-900" />}
            />
            <Button
              size="xs"
              variant="ghost"
              title="View User Activity Logs"
              onClick={() => handleViewProfile(row, "activity")}
              icon={<FaHistory className="text-purple-600 hover:text-purple-800" />}
            />
            <Button
              size="xs"
              variant="ghost"
              title="Login as User (Admin Impersonation)"
              onClick={() => handleLoginAsUser(row)}
              icon={<FaSignInAlt className="text-amber-600 hover:text-amber-800" />}
            />
            {isReseller && (
              <Button
                size="xs"
                variant="outline"
                title="Configure Reseller Markup & API"
                onClick={() => handleOpenResellerConfig(row)}
                icon={<FaSlidersH className="text-indigo-600" />}
              />
            )}
            <Button
              size="xs"
              variant="outline"
              title="Edit Profile"
              onClick={() => handleEditOpen(row)}
              icon={<FaEdit className="text-blue-600" />}
            />
            <Button
              size="xs"
              variant="outline"
              title="Adjust Wallet Balance"
              onClick={() => handleWalletOpen(row)}
              icon={<FaWallet className="text-emerald-600" />}
            />
            <Button
              size="xs"
              variant={row.status === "Active" ? "outline" : "success"}
              title={
                row.status === "Active"
                  ? isReseller
                    ? "Suspend Reseller Account"
                    : "Suspend Account"
                  : isReseller
                  ? "Activate Reseller Account"
                  : "Activate Account"
              }
              onClick={() => handleToggleStatus(row)}
              icon={
                row.status === "Active" ? (
                  <FaBan className="text-rose-600" />
                ) : (
                  <FaCheck className="text-white" />
                )
              }
            />
            <Button
              size="xs"
              variant="outline"
              title="Delete User Account"
              onClick={() => handleDeleteUser(row)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              icon={<FaTrashAlt />}
            />
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
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            User Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Manage user accounts, reseller markups, API credentials, wallet ledgers, and access boundaries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(true)}
            disabled={loading || refreshing}
            icon={
              <FaSync
                className={refreshing || loading ? "animate-spin text-blue-600" : ""}
              />
            }
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleAddOpen}
            icon={<FaPlus />}
          >
            Add User
          </Button>
        </div>
      </div>

      {/* Admin Impersonation Simulation Banner */}
      {activeImpersonation && (
        <div className="mb-6 bg-linear-to-r from-amber-600 via-amber-700 to-orange-700 text-white rounded-2xl p-4 sm:p-5 border border-amber-500 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white text-lg shrink-0 shadow-inner">
              <FaUserSecret />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-white/25 px-2.5 py-0.5 rounded-full text-white border border-white/30">
                  Admin Impersonation Active (Simulation)
                </span>
                <span className="text-xs text-amber-100 font-mono">
                  Session: {activeImpersonation.sessionId}
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-1">
                Currently simulating session view as {activeImpersonation.user.name} ({activeImpersonation.user.email} • {activeImpersonation.user.role})
              </p>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Session started at {activeImpersonation.startedAt}. All mock API requests reflect this user context.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-amber-900 border-white hover:bg-amber-50 font-bold shadow-xs cursor-pointer"
              onClick={() => {
                setActiveImpersonation(null);
                addToast("Admin impersonation session terminated", "success");
              }}
            >
              Exit Impersonation
            </Button>
          </div>
        </div>
      )}

      {/* Primary User Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Users
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
              {metrics.total}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center text-lg shrink-0">
            <FaUsers />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Active Accounts
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">
              {metrics.active}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center text-lg shrink-0">
            <FaUserCheck />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Suspended
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-rose-600 mt-0.5">
              {metrics.suspended}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center text-lg shrink-0">
            <FaUserSlash />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total User Funds
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mt-0.5 font-mono">
              ₹
              {metrics.totalBalance.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100/80 text-amber-600 flex items-center justify-center text-lg shrink-0">
            <FaMoneyBillWave />
          </div>
        </div>
      </div>

      {/* Reseller-Specific Summary Section (rendered whenever reseller records exist) */}
      {resellerMetrics.count > 0 && (
        <div className="mb-6 bg-linear-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-indigo-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-indigo-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <FaStore className="text-sm" />
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                  Reseller Network Overview
                </h4>
                <p className="text-xs text-indigo-200">
                  Telemetry derived from {resellerMetrics.count} registered reseller accounts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRoleFilter(roleFilter === "Reseller" ? "all" : "Reseller");
                  setCurrentPage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition border ${
                  roleFilter === "Reseller"
                    ? "bg-indigo-500 text-white border-indigo-400 shadow-xs"
                    : "bg-indigo-950/60 text-indigo-200 border-indigo-800 hover:bg-indigo-900"
                }`}
              >
                {roleFilter === "Reseller" ? "✓ Filtering Resellers" : "Filter Resellers Only"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Total Resellers
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {resellerMetrics.count}
              </span>
              <span className="text-[10px] text-indigo-300/80">
                {resellerMetrics.active} Active • {resellerMetrics.suspended} Suspended
              </span>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                API Enabled
              </span>
              <span className="text-xl font-black text-emerald-400 mt-0.5 block">
                {resellerMetrics.apiEnabled}
              </span>
              <span className="text-[10px] text-indigo-300/80">
                Of {resellerMetrics.count} resellers
              </span>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Average Markup
              </span>
              <span className="text-xl font-black text-amber-400 mt-0.5 block">
                +{resellerMetrics.avgMarkup}%
              </span>
              <span className="text-[10px] text-indigo-300/80">Catalog price multiplier</span>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Reseller Orders
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {resellerMetrics.totalOrders}
              </span>
              <span className="text-[10px] text-indigo-300/80">Downstream volume</span>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Reseller Earnings
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 font-mono block">
                ₹{resellerMetrics.totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-indigo-300/80">Recorded profit</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-rose-600 text-lg shrink-0" />
            <p className="text-xs sm:text-sm text-rose-800 font-medium">{fetchError}</p>
          </div>
          <Button variant="danger" size="xs" onClick={() => fetchUsers(true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Active Filter Banner when Reseller is selected */}
      {roleFilter === "Reseller" && (
        <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between text-indigo-900 text-xs">
          <div className="flex items-center gap-2">
            <FaStore className="text-indigo-600 text-sm shrink-0" />
            <span>
              <strong className="font-bold">Filtering Reseller Accounts:</strong> Showing {filteredUsers.length} reseller partner records with custom catalog markup, API gateway provisioning, and order volume.
            </span>
          </div>
          <button
            onClick={() => handleRoleChange("all")}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline shrink-0 cursor-pointer ml-2"
          >
            Show All Roles
          </button>
        </div>
      )}

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={paginatedUsers}
        isLoading={loading}
        searchPlaceholder="Search by name, email, phone, or user ID..."
        searchValue={search}
        onSearch={handleSearchChange}
        emptyTitle={
          hasActiveFilters
            ? roleFilter === "Reseller"
              ? "No reseller accounts matched criteria"
              : "No matching users found"
            : "No users registered yet"
        }
        emptySubtitle={
          hasActiveFilters
            ? "Try refining your search terms or resetting selected filters."
            : "Click 'Add User' above to register your first user account."
        }
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredUsers.length,
          pageSize,
          onPageChange: (newPage) => setCurrentPage(newPage),
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 cursor-pointer"
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
            </select>

            {/* Reset Filter Button */}
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

      {/* User Details / Profile Modal (Enhanced with Tabs & Activity Logs) */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={
          selectedUser?.role === "Reseller"
            ? "Reseller Account & API Profile"
            : "User Account Details"
        }
        subtitle={`Account ID: ${selectedUser?.id} • ${selectedUser?.name}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => {
                handleLoginAsUser(selectedUser);
              }}
              icon={<FaSignInAlt className="text-amber-600" />}
            >
              Login as User
            </Button>
            {selectedUser?.role === "Reseller" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDetailsModalOpen(false);
                  handleOpenResellerConfig(selectedUser);
                }}
                icon={<FaSlidersH className="text-indigo-600" />}
              >
                Reseller Settings
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleEditOpen(selectedUser);
              }}
              icon={<FaEdit />}
            >
              Edit Profile
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleWalletOpen(selectedUser);
              }}
              icon={<FaWallet />}
            >
              Adjust Wallet
            </Button>
            <Button
              variant={selectedUser?.status === "Active" ? "danger" : "primary"}
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                handleToggleStatus(selectedUser);
              }}
              icon={selectedUser?.status === "Active" ? <FaBan /> : <FaCheck />}
            >
              {selectedUser?.status === "Active" ? "Suspend Account" : "Activate Account"}
            </Button>
          </>
        }
      >
        {selectedUser && (
          <div>
            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setDetailsModalTab("overview")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                  detailsModalTab === "overview"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FaUsers className="text-xs" />
                <span>Account Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailsModalTab("activity")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                  detailsModalTab === "activity"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FaHistory className="text-xs" />
                <span>Activity & Security Logs</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    detailsModalTab === "activity"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {activityLogs.length}
                </span>
              </button>
            </div>

            {/* TAB 1: ACCOUNT OVERVIEW */}
            {detailsModalTab === "overview" && (
              <div className="space-y-5">
                {/* User Profile Card */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${
                      selectedUser.role === "Reseller"
                        ? "bg-indigo-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {selectedUser.name
                      ? selectedUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()
                      : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-gray-900 truncate">
                        {selectedUser.name}
                      </h4>
                      <Badge status={selectedUser.status} size="xs" />
                      {selectedUser.role === "Reseller" && (
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                          Reseller Partner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{selectedUser.email}</p>
                    {selectedUser.phone && (
                      <p className="text-xs text-gray-500 mt-0.5">{selectedUser.phone}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-mono text-xs text-gray-400 bg-white px-2.5 py-1 rounded border border-gray-200">
                      {selectedUser.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLoginAsUser(selectedUser)}
                      className="text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-colors"
                      title="Login as user in simulated session"
                    >
                      <FaSignInAlt className="text-[10px]" />
                      <span>Impersonate</span>
                    </button>
                  </div>
                </div>

                {/* Financial & Order Overview Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                      Wallet Balance
                    </span>
                    <span className="text-lg font-bold text-emerald-700 font-mono mt-1 block">
                      ₹
                      {(Number(selectedUser.balance) || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
                      Total Spent
                    </span>
                    <span className="text-lg font-bold text-blue-700 font-mono mt-1 block">
                      ₹
                      {(Number(selectedUser.spent) || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider block">
                      Total Orders
                    </span>
                    <span className="text-lg font-bold text-indigo-700 mt-1 block">
                      {selectedUser.ordersCount || 0}
                    </span>
                  </div>
                </div>

                {/* Dedicated Reseller Operations Card (Only for Reseller Role) */}
                {selectedUser.role === "Reseller" && (
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
                      <div className="flex items-center gap-2">
                        <FaStore className="text-indigo-600" />
                        <h5 className="font-bold text-xs uppercase tracking-wider text-indigo-900">
                          Reseller Gateway & Catalog Configuration
                        </h5>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          selectedUser.apiEnabled
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                        }`}
                      >
                        {selectedUser.apiEnabled ? "● API Gateway Active" : "○ API Inactive"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-gray-500 text-[11px] block">Markup Margin</span>
                        <span className="font-bold text-sm text-indigo-900 block mt-0.5">
                          +{selectedUser.markup ?? 10}%
                        </span>
                        <span className="text-[10px] text-gray-400">On all services</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-gray-500 text-[11px] block">Reseller Earnings</span>
                        <span className="font-bold text-sm text-emerald-700 font-mono block mt-0.5">
                          ₹{Number(selectedUser.resellerEarnings || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-400">Recorded profit</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-gray-500 text-[11px] block">API Rate Limit</span>
                        <span className="font-bold text-sm text-gray-800 block mt-0.5">
                          {selectedUser.rateLimit ?? 120} req/min
                        </span>
                        <span className="text-[10px] text-gray-400">Endpoint throttle</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                        <span className="text-gray-500 text-[11px] block">Downstream Orders</span>
                        <span className="font-bold text-sm text-indigo-700 block mt-0.5">
                          {selectedUser.resellerOrdersCount ?? selectedUser.ordersCount ?? 0}
                        </span>
                        <span className="text-[10px] text-gray-400">Storefront orders</span>
                      </div>
                    </div>

                    {/* Masked API Key & Security Snapshot */}
                    <div className="bg-white p-3 rounded-lg border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                          <FaKey className="text-amber-500 text-xs" />
                          Provisioned API Key (Masked)
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Rotated: {selectedUser.apiKeyLastGenerated || "2026-08-25"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900 text-slate-100 px-3 py-2 rounded-md font-mono text-xs">
                        <span className="truncate max-w-[280px]">
                          {selectedUser.apiKey || "grom_res_live_••••••••••••4a89"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                selectedUser.apiKey || "grom_res_live_••••••••••••4a89"
                              )
                            }
                            className="text-slate-400 hover:text-white p-1"
                            title="Copy masked identifier"
                          >
                            {copiedKey ? (
                              <FaCheck className="text-xs text-emerald-400" />
                            ) : (
                              <FaCopy className="text-xs" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            variant={selectedUser.apiEnabled ? "danger" : "success"}
                            onClick={() => handleToggleResellerApi(selectedUser)}
                          >
                            {selectedUser.apiEnabled ? "Disable API" : "Enable API"}
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleRegenerateApiKey(selectedUser)}
                          >
                            Regenerate API Key
                          </Button>
                        </div>
                        <span className="text-[11px] text-gray-400 italic">
                          Keys never displayed in cleartext
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* General Account Attributes */}
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs">
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Assigned Role</span>
                    <span className="font-semibold text-gray-800">{selectedUser.role}</span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Account Status</span>
                    <span
                      className={`font-semibold ${
                        selectedUser.status === "Active"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      ● {selectedUser.status}
                    </span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Registration Date</span>
                    <span className="text-gray-700 font-mono">
                      {selectedUser.createdAt || "N/A"}
                    </span>
                  </div>
                  <div className="p-3 flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Last Activity / Login</span>
                    <span className="text-gray-700">{selectedUser.lastLogin || "N/A"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ACTIVITY & SECURITY LOGS */}
            {detailsModalTab === "activity" && (
              <div className="space-y-4">
                {/* Activity Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search activities, IP, device, or notes..."
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800"
                    />
                    <FaSearch className="absolute left-2.5 top-2.5 text-gray-400 text-xs" />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <select
                      value={activityTypeFilter}
                      onChange={(e) => setActivityTypeFilter(e.target.value)}
                      className="text-xs py-2 px-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 cursor-pointer"
                    >
                      <option value="all">All Event Types</option>
                      <option value="LOGIN">User Logins</option>
                      <option value="LOGIN_FAILED">Failed Auth Attempts</option>
                      <option value="ORDER_PLACED">Order Placed</option>
                      <option value="WALLET_RECHARGE">Wallet Recharges</option>
                      <option value="SECURITY">Security / Passwords</option>
                      <option value="API_ACCESS">Reseller API Calls</option>
                      <option value="PROFILE_UPDATE">Profile Updates</option>
                      <option value="TICKET_CREATED">Support Tickets</option>
                      <option value="STATUS_CHANGE">Status Changes</option>
                    </select>

                    <select
                      value={activityStatusFilter}
                      onChange={(e) => setActivityStatusFilter(e.target.value)}
                      className="text-xs py-2 px-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 cursor-pointer"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Success">Success</option>
                      <option value="Failed">Failed</option>
                      <option value="Warning">Warning</option>
                    </select>

                    <Button
                      variant="ghost"
                      size="xs"
                      title="Refresh Logs"
                      onClick={() => fetchUserActivity(selectedUser.id)}
                      disabled={activityLoading}
                      icon={
                        <FaSync
                          className={activityLoading ? "animate-spin text-blue-600 text-xs" : "text-xs"}
                        />
                      }
                    />
                  </div>
                </div>

                {/* Activity Logs Stream */}
                {activityLoading ? (
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                ) : filteredActivityLogs.length === 0 ? (
                  <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FaHistory className="mx-auto text-3xl text-gray-300 mb-2" />
                    <p className="text-sm font-bold text-gray-700">No Activity Logs Found</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activitySearch || activityTypeFilter !== "all" || activityStatusFilter !== "all"
                        ? "No records matched the selected search or filter criteria."
                        : "No security activity recorded for this user yet."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {filteredActivityLogs.map((log) => {
                      const typeInfo = getActivityTypeInfo(log.type);
                      const isFailed = log.status === "Failed";
                      const isWarning = log.status === "Warning";

                      return (
                        <div
                          key={log.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isFailed
                              ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
                              : isWarning
                              ? "bg-amber-50/40 border-amber-200 hover:border-amber-300"
                              : "bg-white border-gray-200 hover:border-gray-300 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 border mt-0.5 ${typeInfo.bgColor}`}
                              >
                                {typeInfo.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs sm:text-sm text-gray-900">
                                    {log.action || log.type}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${typeInfo.bgColor}`}
                                  >
                                    {typeInfo.label}
                                  </span>
                                  <Badge status={log.status} size="xs" />
                                </div>
                                <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                                  {log.description}
                                </p>
                              </div>
                            </div>

                            <span className="text-[11px] font-mono text-gray-400 shrink-0 whitespace-nowrap">
                              {log.timestamp}
                            </span>
                          </div>

                          {/* Extra Audit Metadata */}
                          <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
                            <div className="flex items-center gap-3 flex-wrap">
                              {log.device && (
                                <span className="flex items-center gap-1">
                                  {log.device.toLowerCase().includes("mobile") ||
                                  log.device.toLowerCase().includes("ios") ||
                                  log.device.toLowerCase().includes("android") ? (
                                    <FaMobileAlt className="text-gray-400" />
                                  ) : log.device.toLowerCase().includes("api") ? (
                                    <FaKey className="text-indigo-400" />
                                  ) : (
                                    <FaDesktop className="text-gray-400" />
                                  )}
                                  <span>{log.device}</span>
                                </span>
                              )}
                              {log.ip && (
                                <span className="flex items-center gap-1 font-mono">
                                  <FaGlobe className="text-gray-400" />
                                  <span>{log.ip}</span>
                                  {log.location && (
                                    <span className="text-gray-400">({log.location})</span>
                                  )}
                                </span>
                              )}
                            </div>

                            <span className="font-mono text-[10px] text-gray-400">
                              ID: {log.id}
                            </span>
                          </div>

                          {log.details && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[11px] text-slate-700 font-sans border border-slate-100 flex items-start gap-1.5">
                              <FaInfoCircle className="text-slate-400 shrink-0 mt-0.5 text-xs" />
                              <span>{log.details}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Dedicated Reseller Operations & Markup Modal */}
      {selectedUser && (
        <Modal
          isOpen={resellerModalOpen}
          onClose={() => setResellerModalOpen(false)}
          title={`Configure Reseller: ${selectedUser.name}`}
          subtitle={`Account ID: ${selectedUser.id} • Markup & API Management`}
          size="md"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResellerModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveResellerConfig}
                isLoading={isSubmitting}
              >
                Save Reseller Settings
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveResellerConfig} className="space-y-4">
            {/* Markup Setting */}
            <div>
              <Input
                label="Reseller Markup Percentage (%)"
                type="number"
                step="0.1"
                min="0"
                max="200"
                required
                icon={<FaPercent className="text-xs" />}
                placeholder="e.g. 10.0"
                value={resellerForm.markup}
                error={formErrors.markup}
                onChange={(e) =>
                  setResellerForm({ ...resellerForm, markup: e.target.value })
                }
                helperText="Percentage markup applied on top of standard base catalog prices for this reseller's storefront."
              />

              {/* Live Calculator Preview */}
              {resellerForm.markup &&
                !isNaN(Number(resellerForm.markup)) &&
                Number(resellerForm.markup) >= 0 && (
                  <div className="mt-2.5 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs space-y-1">
                    <span className="font-bold text-indigo-900 block flex items-center gap-1">
                      <FaBolt className="text-amber-500 text-[10px]" />
                      Live Price Simulation Example:
                    </span>
                    <div className="flex items-center justify-between text-indigo-800 pt-0.5">
                      <span>Base Service Cost:</span>
                      <span className="font-mono font-semibold">₹100.00</span>
                    </div>
                    <div className="flex items-center justify-between text-indigo-800">
                      <span>Applied Markup (+{Number(resellerForm.markup).toFixed(1)}%):</span>
                      <span className="font-mono font-semibold">
                        +₹{(100 * (Number(resellerForm.markup) / 100)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-indigo-950 font-bold border-t border-indigo-200/60 pt-1">
                      <span>Reseller Storefront Price:</span>
                      <span className="font-mono text-sm text-indigo-900">
                        ₹{(100 * (1 + Number(resellerForm.markup) / 100)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
            </div>

            {/* API Access Switch */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <label className="block text-sm font-medium text-gray-800">
                API Integration Access
              </label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-700">
                    {resellerForm.apiEnabled
                      ? "API Gateway Enabled"
                      : "API Gateway Disabled"}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Allow downstream bot scripts and SMM software to place orders via API
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setResellerForm({
                      ...resellerForm,
                      apiEnabled: !resellerForm.apiEnabled,
                    })
                  }
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    resellerForm.apiEnabled ? "bg-indigo-600 justify-end" : "bg-gray-300 justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                </button>
              </div>
            </div>

            {/* Rate Limit Setting */}
            <Input
              label="API Rate Limit (Requests per Minute)"
              type="number"
              step="1"
              min="10"
              max="1000"
              required
              icon={<FaShieldAlt className="text-xs" />}
              placeholder="e.g. 120"
              value={resellerForm.rateLimit}
              error={formErrors.rateLimit}
              onChange={(e) =>
                setResellerForm({ ...resellerForm, rateLimit: e.target.value })
              }
              helperText="Maximum allowed HTTP requests per minute on v2 API endpoints."
            />

            {/* API Key Status Info */}
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <FaKey className="text-amber-400 text-xs" />
                  Active API Key (Masked)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedUser.apiKeyLastGenerated || "Active"}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-200 bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center">
                <span>{selectedUser.apiKey || "grom_res_live_••••••••••••4a89"}</span>
                <button
                  type="button"
                  onClick={() => handleRegenerateApiKey(selectedUser)}
                  className="text-xs text-amber-400 hover:text-amber-300 underline font-sans ml-2"
                >
                  Regenerate
                </button>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Note: In accordance with security protocol, raw private keys are never stored in browser memory or console logs.
              </p>
            </div>
          </form>
        </Modal>
      )}

      {/* Add User Modal (Enhanced with Reseller Fields) */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New User Account"
        subtitle="Create a new customer, reseller, or administrative account"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddSubmit}
              isLoading={isSubmitting}
            >
              Create Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            placeholder="e.g. Ramesh Kumar"
            value={addForm.name}
            error={formErrors.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            required
            placeholder="e.g. ramesh@example.com"
            value={addForm.email}
            error={formErrors.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
          />

          <Input
            label="Phone Number"
            placeholder="e.g. +91 98765 43210"
            value={addForm.phone}
            onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Status
              </label>
              <select
                value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <Input
            label="Initial Wallet Balance (₹)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={addForm.balance}
            error={formErrors.balance}
            onChange={(e) => setAddForm({ ...addForm, balance: e.target.value })}
          />

          {/* Conditional Reseller Fields */}
          {addForm.role === "Reseller" && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <FaStore className="text-indigo-600" />
                <span>Reseller Initial Configuration</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Initial Markup (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  required
                  placeholder="10.0"
                  value={addForm.markup}
                  error={formErrors.markup}
                  onChange={(e) => setAddForm({ ...addForm, markup: e.target.value })}
                  helperText="Default markup percentage"
                />

                <Input
                  label="API Rate Limit (req/min)"
                  type="number"
                  step="1"
                  min="10"
                  max="1000"
                  required
                  placeholder="120"
                  value={addForm.rateLimit}
                  error={formErrors.rateLimit}
                  onChange={(e) => setAddForm({ ...addForm, rateLimit: e.target.value })}
                  helperText="Initial API burst threshold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  API Provisioning
                </label>
                <select
                  value={addForm.apiEnabled ? "true" : "false"}
                  onChange={(e) =>
                    setAddForm({
                      ...addForm,
                      apiEnabled: e.target.value === "true",
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="true">Enable API Gateway Immediately</option>
                  <option value="false">Keep API Disabled Initially</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Edit User Modal (Enhanced with Reseller Fields) */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User Profile"
        subtitle={`Updating account ${selectedUser?.id}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSave}
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={editForm.name}
            error={formErrors.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={editForm.email}
            error={formErrors.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />

          <Input
            label="Phone Number"
            placeholder="e.g. +91 98765 43210"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Status
              </label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Conditional Reseller Fields in Edit */}
          {editForm.role === "Reseller" && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <FaStore className="text-indigo-600" />
                <span>Reseller Operational Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Catalog Markup (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  required
                  value={editForm.markup}
                  error={formErrors.markup}
                  onChange={(e) => setEditForm({ ...editForm, markup: e.target.value })}
                  helperText="Markup on standard rate card"
                />

                <Input
                  label="API Rate Limit (req/min)"
                  type="number"
                  step="1"
                  min="10"
                  max="1000"
                  required
                  value={editForm.rateLimit}
                  error={formErrors.rateLimit}
                  onChange={(e) => setEditForm({ ...editForm, rateLimit: e.target.value })}
                  helperText="Endpoint request throttling"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  API Gateway Access Status
                </label>
                <select
                  value={editForm.apiEnabled ? "true" : "false"}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      apiEnabled: e.target.value === "true",
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="true">API Enabled</option>
                  <option value="false">API Disabled</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Manual Wallet Adjustment Modal */}
      <Modal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        title="Manual Wallet Adjustment"
        subtitle={`Adjust balance for ${selectedUser?.name} (${selectedUser?.email})`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWalletModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleWalletSubmit}
              isLoading={isSubmitting}
            >
              Apply Adjustment
            </Button>
          </>
        }
      >
        <form onSubmit={handleWalletSubmit} className="space-y-4">
          {/* Current Balance Display */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center text-sm">
            <span className="text-gray-600">Current Balance:</span>
            <span className="font-mono font-bold text-gray-900 text-base">
              ₹{(selectedUser?.balance || 0).toFixed(2)}
            </span>
          </div>

          {/* Adjustment Type Switcher */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adjustment Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWalletForm({ ...walletForm, type: "credit" })}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  walletForm.type === "credit"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FaPlus className="text-[10px]" />
                <span>Credit Funds (Add)</span>
              </button>
              <button
                type="button"
                onClick={() => setWalletForm({ ...walletForm, type: "debit" })}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  walletForm.type === "debit"
                    ? "bg-rose-50 border-rose-500 text-rose-700 shadow-xs"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FaBan className="text-[10px]" />
                <span>Debit Funds (Deduct)</span>
              </button>
            </div>
          </div>

          <Input
            label="Amount (INR ₹)"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="e.g. 500.00"
            value={walletForm.amount}
            error={formErrors.amount}
            onChange={(e) => setWalletForm({ ...walletForm, amount: e.target.value })}
          />

          {/* Projected Balance Calculation Preview */}
          {walletForm.amount &&
            !isNaN(Number(walletForm.amount)) &&
            Number(walletForm.amount) > 0 && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs flex justify-between items-center text-blue-900">
                <span>Projected New Balance:</span>
                <span className="font-mono font-bold text-sm">
                  ₹
                  {(
                    walletForm.type === "credit"
                      ? (selectedUser?.balance || 0) + Number(walletForm.amount)
                      : Math.max(
                          0,
                          (selectedUser?.balance || 0) - Number(walletForm.amount)
                        )
                  ).toFixed(2)}
                </span>
              </div>
            )}

          <Input
            label="Reason / Audit Note"
            required
            placeholder="e.g. Manual UPI payment confirmation, reseller bonus"
            value={walletForm.reason}
            error={formErrors.reason}
            onChange={(e) => setWalletForm({ ...walletForm, reason: e.target.value })}
          />

          <Input
            label="Transaction Reference / UTR ID"
            placeholder="e.g. UTR-98213812 or Ticket #T-402 (Optional)"
            value={walletForm.reference}
            onChange={(e) =>
              setWalletForm({ ...walletForm, reference: e.target.value })
            }
          />
        </form>
      </Modal>

      {/* Universal Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={handleConfirmAction}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}

export default AdminUsers;

