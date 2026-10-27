/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaUndo,
  FaSlidersH,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaPlus,
  FaSync,
  FaEye,
  FaCopy,
  FaCheck,
  FaWallet,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaInfoCircle,
  FaUser,
  FaMoneyBillWave,
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

function AdminFinance() {
  const { addToast } = useToast();

  // Primary Data State
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filter State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  // Details Modal State
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  // Manual Adjustment Form State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    userId: "",
    user: "",
    userEmail: "",
    type: "Credit",
    amount: "",
    method: "Manual Admin Credit",
    refId: "",
    reason: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Row Action Loading State
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "primary",
    onConfirm: null,
    isLoading: false,
  });

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const [txnData, userData] = await Promise.all([
          adminService.getTransactions(),
          adminService.getUsers().catch(() => []),
        ]);

        setTransactions(Array.isArray(txnData) ? txnData : []);
        setUsers(Array.isArray(userData) ? userData : []);

        if (isManualRefresh) {
          addToast("Financial records and ledger refreshed", "success");
        }
      } catch (err) {
        console.error("Failed to load financial records:", err);
        setFetchError("Failed to load financial records. Please try again.");
        addToast("Failed to load financial records", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------
  // Dynamic KPI Metrics (Calculated from transactions dataset)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const totalTransactions = transactions.length;

    let totalCredits = 0;
    let totalDebits = 0;
    let totalRefunds = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const type = (t.type || "").toLowerCase();
      const status = (t.status || "").toLowerCase();

      const isCompleted = status.includes("complete") || status.includes("success");
      const isPending = status.includes("pending");

      if (isCompleted) {
        if (type.includes("credit") || type.includes("deposit")) {
          totalCredits += amt;
        } else if (type.includes("debit")) {
          totalDebits += amt;
        } else if (type.includes("refund")) {
          totalRefunds += amt;
        } else if (type.includes("adjust")) {
          // Check method or text for adjustment direction
          const methodText = (t.method || "").toLowerCase();
          if (methodText.includes("credit")) {
            totalCredits += amt;
          } else if (methodText.includes("debit")) {
            totalDebits += amt;
          }
        }
      }

      if (isPending) {
        pendingCount += 1;
        pendingAmount += amt;
      }
    });

    return {
      totalTransactions,
      totalCredits,
      totalDebits,
      totalRefunds,
      pendingCount,
      pendingAmount,
    };
  }, [transactions]);

  // -------------------------------------------------------------
  // Filtered Transactions
  // -------------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();

    return transactions.filter((t) => {
      // Search matches
      const matchesSearch =
        !q ||
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.user && t.user.toLowerCase().includes(q)) ||
        (t.userEmail && t.userEmail.toLowerCase().includes(q)) ||
        (t.refId && t.refId.toLowerCase().includes(q)) ||
        (t.method && t.method.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));

      // Type filter
      let matchesType = true;
      if (typeFilter !== "all") {
        const typeLower = (t.type || "").toLowerCase();
        if (typeFilter === "Credit") {
          matchesType = typeLower.includes("credit") || typeLower.includes("deposit");
        } else if (typeFilter === "Debit") {
          matchesType = typeLower.includes("debit");
        } else if (typeFilter === "Refund") {
          matchesType = typeLower.includes("refund");
        } else if (typeFilter === "Adjustment") {
          matchesType = typeLower.includes("adjust");
        }
      }

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== "all") {
        const statusLower = (t.status || "").toLowerCase();
        if (statusFilter === "Completed") {
          matchesStatus = statusLower.includes("complete") || statusLower.includes("success");
        } else if (statusFilter === "Pending Approval") {
          matchesStatus = statusLower.includes("pending");
        } else if (statusFilter === "Failed") {
          matchesStatus = statusLower.includes("fail") || statusLower.includes("reject");
        } else if (statusFilter === "Refunded") {
          matchesStatus = statusLower.includes("refund");
        }
      }

      // Method filter
      let matchesMethod = true;
      if (methodFilter !== "all") {
        const methodLower = (t.method || "").toLowerCase();
        matchesMethod = methodLower.includes(methodFilter.toLowerCase());
      }

      return matchesSearch && matchesType && matchesStatus && matchesMethod;
    });
  }, [transactions, search, typeFilter, statusFilter, methodFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    methodFilter !== "all";

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setMethodFilter("all");
  };

  // -------------------------------------------------------------
  // Actions: Approve Recharge
  // -------------------------------------------------------------
  const handleApproveClick = (txn) => {
    setConfirmDialog({
      isOpen: true,
      title: `Approve Recharge #${txn.id}?`,
      message: `Are you sure you want to verify and approve the payment of ₹${Number(
        txn.amount
      ).toLocaleString("en-IN")} for ${txn.user}? This will immediately credit their wallet balance.`,
      variant: "success",
      confirmText: "Approve & Credit Balance",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        setActionLoadingId(txn.id);
        try {
          await adminService.approveManualRecharge(txn.id);

          setTransactions((prev) =>
            prev.map((t) => (t.id === txn.id ? { ...t, status: "Completed" } : t))
          );

          if (selectedTxn && selectedTxn.id === txn.id) {
            setSelectedTxn((prev) => ({ ...prev, status: "Completed" }));
          }

          // Refresh users list to reflect new wallet balances
          adminService
            .getUsers()
            .then((u) => setUsers(Array.isArray(u) ? u : []))
            .catch(() => {});

          addToast(
            `Payment #${txn.id} approved. ₹${Number(txn.amount).toLocaleString(
              "en-IN"
            )} credited to ${txn.user}'s wallet.`,
            "success"
          );
        } catch (err) {
          console.error("Failed to approve transaction:", err);
          addToast("Failed to approve transaction", "error");
        } finally {
          setActionLoadingId(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  // -------------------------------------------------------------
  // Actions: Reject Recharge
  // -------------------------------------------------------------
  const handleRejectClick = (txn) => {
    setConfirmDialog({
      isOpen: true,
      title: `Reject Transaction #${txn.id}?`,
      message: `Are you sure you want to mark the transaction of ₹${Number(
        txn.amount
      ).toLocaleString("en-IN")} for ${txn.user} as failed/rejected?`,
      variant: "danger",
      confirmText: "Reject Transaction",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        setActionLoadingId(txn.id);
        try {
          if (adminService.rejectTransaction) {
            await adminService.rejectTransaction(txn.id, "Rejected via admin finance ledger");
          }

          setTransactions((prev) =>
            prev.map((t) => (t.id === txn.id ? { ...t, status: "Failed" } : t))
          );

          if (selectedTxn && selectedTxn.id === txn.id) {
            setSelectedTxn((prev) => ({ ...prev, status: "Failed" }));
          }

          addToast(`Transaction #${txn.id} has been marked as Failed/Rejected`, "info");
        } catch (err) {
          console.error("Failed to reject transaction:", err);
          addToast("Failed to reject transaction", "error");
        } finally {
          setActionLoadingId(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  // -------------------------------------------------------------
  // Actions: Open Transaction Details
  // -------------------------------------------------------------
  const handleOpenDetails = (txn) => {
    setSelectedTxn(txn);
    setCopiedRef(false);
    setDetailsModalOpen(true);
  };

  const handleCopyRef = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedRef(true);
    addToast("Reference ID copied to clipboard", "info");
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // -------------------------------------------------------------
  // Manual Ledger Entry / Balance Adjustment Form Handling
  // -------------------------------------------------------------
  const handleOpenManualModal = () => {
    setManualForm({
      userId: users.length > 0 ? users[0].id : "",
      user: users.length > 0 ? users[0].name : "",
      userEmail: users.length > 0 ? users[0].email : "",
      type: "Credit",
      amount: "",
      method: "Manual Admin Credit",
      refId: `ADM-ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
      reason: "",
    });
    setFormErrors({});
    setManualModalOpen(true);
  };

  const handleUserSelectChange = (e) => {
    const selectedId = e.target.value;
    const foundUser = users.find((u) => u.id === selectedId);

    if (foundUser) {
      setManualForm((prev) => ({
        ...prev,
        userId: foundUser.id,
        user: foundUser.name,
        userEmail: foundUser.email,
      }));
    } else {
      setManualForm((prev) => ({
        ...prev,
        userId: "",
        user: selectedId,
        userEmail: "",
      }));
    }
  };

  const handleTypeChange = (newType) => {
    const defaultMethod =
      newType === "Credit" ? "Manual Admin Credit" : "Manual Admin Debit";

    setManualForm((prev) => ({
      ...prev,
      type: newType,
      method: defaultMethod,
    }));
  };

  const validateManualForm = () => {
    const errors = {};

    if (!manualForm.user.trim()) {
      errors.user = "Customer name or user selection is required";
    }

    const numAmt = Number(manualForm.amount);
    if (!manualForm.amount || isNaN(numAmt) || numAmt <= 0) {
      errors.amount = "Amount must be a valid number greater than ₹0";
    }

    if (!manualForm.reason.trim() || manualForm.reason.trim().length < 4) {
      errors.reason = "Reason / remark is required (minimum 4 characters)";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!validateManualForm()) {
      addToast("Please fill all required fields correctly", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const recordPayload = {
        userId: manualForm.userId,
        user: manualForm.user.trim(),
        userEmail: manualForm.userEmail,
        type: manualForm.type,
        amount: Number(manualForm.amount),
        fee: 0,
        status: "Completed",
        method: manualForm.method,
        refId: manualForm.refId.trim() || `ADM-ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
        description: manualForm.reason.trim(),
      };

      const created = await adminService.recordTransaction(recordPayload);

      setTransactions((prev) => [created, ...prev]);

      // Refresh users to sync updated balance
      adminService
        .getUsers()
        .then((u) => setUsers(Array.isArray(u) ? u : []))
        .catch(() => {});

      addToast(
        `Manual ${manualForm.type.toLowerCase()} of ₹${Number(
          manualForm.amount
        ).toFixed(2)} recorded successfully for ${manualForm.user}`,
        "success"
      );

      setManualModalOpen(false);
    } catch (err) {
      console.error("Failed to record manual ledger transaction:", err);
      addToast("Failed to record transaction", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selected user helper for preview in modal
  const selectedUserObj = useMemo(() => {
    if (!manualForm.userId) {
      return users.find(
        (u) => u.name.toLowerCase() === manualForm.user.toLowerCase()
      );
    }
    return users.find((u) => u.id === manualForm.userId);
  }, [users, manualForm.userId, manualForm.user]);

  // -------------------------------------------------------------
  // Table Columns Definition
  // -------------------------------------------------------------
  const columns = [
    {
      header: "Txn ID",
      accessor: "id",
      className: "font-mono font-bold text-xs text-blue-600 whitespace-nowrap",
      render: (row) => (
        <button
          onClick={() => handleOpenDetails(row)}
          className="hover:underline font-mono font-bold text-xs text-blue-600 text-left flex items-center gap-1.5"
          title="Click to view details"
        >
          <span>{row.id}</span>
        </button>
      ),
    },
    {
      header: "Customer",
      accessor: "user",
      render: (row) => (
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
            {row.user ? row.user.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="truncate">
            <p className="font-semibold text-xs text-gray-900 truncate">
              {row.user || "Unknown User"}
            </p>
            {row.userEmail && (
              <p className="text-[10px] text-gray-400 truncate">{row.userEmail}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Type",
      accessor: "type",
      render: (row) => {
        const typeStr = (row.type || "").toLowerCase();
        let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        let icon = <FaArrowDown className="text-[10px]" />;
        let label = "Credit";

        if (typeStr.includes("debit")) {
          badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
          icon = <FaArrowUp className="text-[10px]" />;
          label = "Debit";
        } else if (typeStr.includes("refund")) {
          badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
          icon = <FaUndo className="text-[10px]" />;
          label = "Refund";
        } else if (typeStr.includes("adjust")) {
          badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
          icon = <FaSlidersH className="text-[10px]" />;
          label = "Adjustment";
        } else if (typeStr.includes("deposit")) {
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
          icon = <FaArrowDown className="text-[10px]" />;
          label = "Deposit";
        }

        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeClass}`}
          >
            {icon}
            {label}
          </span>
        );
      },
    },
    {
      header: "Amount",
      accessor: "amount",
      sortable: true,
      render: (row) => {
        const typeStr = (row.type || "").toLowerCase();
        const isCredit =
          typeStr.includes("credit") ||
          typeStr.includes("deposit") ||
          typeStr.includes("refund") ||
          (typeStr.includes("adjust") &&
            (row.method || "").toLowerCase().includes("credit"));

        const numAmt = Number(row.amount) || 0;
        const formatted = `₹${numAmt.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

        return (
          <div>
            <span
              className={`font-mono font-bold text-sm ${
                isCredit ? "text-emerald-600" : "text-gray-900"
              }`}
            >
              {isCredit ? `+${formatted}` : `-${formatted}`}
            </span>
            {row.fee && Number(row.fee) > 0 ? (
              <span className="block text-[10px] text-gray-400">
                Fee: ₹{Number(row.fee).toFixed(2)}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "Channel / Reference",
      accessor: "method",
      render: (row) => (
        <div className="max-w-[200px]">
          <p className="text-xs font-medium text-gray-800 truncate">
            {row.method || "Direct Gateway"}
          </p>
          <span className="text-[10px] text-gray-400 font-mono block truncate">
            Ref: {row.refId || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => <Badge status={row.status} size="xs" />,
    },
    {
      header: "Timestamp",
      accessor: "createdAt",
      render: (row) => (
        <div className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap">
          <FaClock className="text-[10px] text-gray-400 shrink-0" />
          <span>{row.createdAt || row.date || "N/A"}</span>
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: "actions",
      render: (row) => {
        const isPending = (row.status || "").toLowerCase().includes("pending");

        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleOpenDetails(row)}
              icon={<FaEye className="text-xs" />}
              title="View Transaction Details"
            >
              Details
            </Button>

            {isPending && (
              <>
                <Button
                  size="xs"
                  variant="success"
                  onClick={() => handleApproveClick(row)}
                  isLoading={actionLoadingId === row.id}
                  icon={<FaCheckCircle className="text-xs" />}
                  title="Approve Recharge"
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  onClick={() => handleRejectClick(row)}
                  isLoading={actionLoadingId === row.id}
                  icon={<FaTimesCircle className="text-xs" />}
                  title="Reject Transaction"
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        );
      },
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
              <FaWallet className="text-lg" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Finance & Transactions
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Audit real-time recharges, manual wallet ledger entries, debit records, and financial flow
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<FaSync className={refreshing ? "animate-spin" : ""} />}
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FaPlus />}
            onClick={handleOpenManualModal}
          >
            Record Ledger Entry
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
          <h3 className="text-base font-bold text-rose-900">Failed to Load Finance Data</h3>
          <p className="text-xs text-rose-600 max-w-md mx-auto">{fetchError}</p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchData(false)}
            icon={<FaSync />}
          >
            Retry Loading
          </Button>
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------------- */}
          {/* Dynamic Summary KPI Cards */}
          {/* ------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Transactions */}
            <div
              onClick={() => {
                setTypeFilter("all");
                setStatusFilter("all");
              }}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Total Ledger Records
                </p>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                  <FaExchangeAlt />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mt-2">
                {metrics.totalTransactions}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                Audited deposits, charges & ledger adjustments
              </p>
            </div>

            {/* Total Credits / Recharges */}
            <div
              onClick={() => setTypeFilter("Credit")}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-emerald-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                  Total Recharges / Credits
                </p>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                  <FaArrowDown />
                </div>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 mt-2">
                ₹{metrics.totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                100% verified gateway & manual deposits
              </p>
            </div>

            {/* Total Debits */}
            <div
              onClick={() => setTypeFilter("Debit")}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-rose-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-rose-700 font-semibold uppercase tracking-wider">
                  Total Debits / Charges
                </p>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-sm">
                  <FaArrowUp />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mt-2">
                ₹{metrics.totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                Service deductions & order spends
              </p>
            </div>

            {/* Pending Verifications */}
            <div
              onClick={() => setStatusFilter("Pending Approval")}
              className={`bg-white p-5 rounded-xl border shadow-xs transition-colors cursor-pointer ${
                metrics.pendingCount > 0
                  ? "border-amber-300 bg-amber-50/30"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-800 font-semibold uppercase tracking-wider">
                  Pending Verification
                </p>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
                  <FaClock />
                </div>
              </div>
              <h3 className="text-2xl font-black text-amber-600 mt-2">
                {metrics.pendingCount}{" "}
                <span className="text-sm font-semibold text-gray-500">
                  ({`₹${metrics.pendingAmount.toLocaleString("en-IN")}`})
                </span>
              </h3>
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                {metrics.pendingCount > 0
                  ? "Requires admin review / approval"
                  : "All deposit requests clear"}
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Main Transaction DataTable */}
          {/* ------------------------------------------------------------- */}
          <DataTable
            columns={columns}
            data={filteredTransactions}
            isLoading={loading}
            searchable={true}
            searchPlaceholder="Search by Txn ID, User, Email, Ref or Method..."
            searchValue={search}
            onSearch={setSearch}
            emptyTitle="No Financial Transactions Found"
            emptySubtitle="No transactions match your active search or filter criteria."
            filters={
              <div className="flex flex-wrap items-center gap-2">
                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="Credit">Credits & Deposits (+)</option>
                  <option value="Debit">Debits & Charges (-)</option>
                  <option value="Refund">Refunds (↩)</option>
                  <option value="Adjustment">Manual Adjustments (⚙)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Completed">Completed / Success</option>
                  <option value="Pending Approval">Pending Verification</option>
                  <option value="Failed">Failed / Rejected</option>
                  <option value="Refunded">Refunded</option>
                </select>

                {/* Method Filter */}
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Payment Channels</option>
                  <option value="UPI">UPI QR / VPA</option>
                  <option value="Razorpay">Razorpay Gateway</option>
                  <option value="Paytm">Paytm Gateway</option>
                  <option value="Manual Admin">Manual Admin Ledger</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="Wallet">Wallet Internal</option>
                </select>

                {/* Reset Filters Button */}
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
      {/* Modal 1: Record Manual Ledger Entry / Balance Adjustment */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => !isSubmitting && setManualModalOpen(false)}
        title="Record Manual Wallet Ledger Entry"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleManualSubmit}
              isLoading={isSubmitting}
              icon={<FaCheckCircle />}
            >
              Post Ledger Entry
            </Button>
          </>
        }
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
            <FaInfoCircle className="text-blue-600 mt-0.5 shrink-0 text-base" />
            <p className="text-xs text-blue-900 leading-relaxed">
              Recording a manual transaction directly creates an auditable ledger record
              and synchronizes the customer&apos;s current wallet balance immediately.
            </p>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Customer Account <span className="text-rose-500">*</span>
            </label>
            {users.length > 0 ? (
              <select
                value={manualForm.userId}
                onChange={handleUserSelectChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.user ? "border-rose-500" : "border-gray-300"
                }`}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email || u.id}) — Current Balance: ₹
                    {Number(u.balance || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="Enter customer username or email"
                value={manualForm.user}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    user: e.target.value,
                    userId: "",
                  })
                }
                error={formErrors.user}
                required
              />
            )}
            {formErrors.user && (
              <p className="text-xs text-rose-500 mt-1">{formErrors.user}</p>
            )}
          </div>

          {/* Adjustment Direction Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Adjustment Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange("Credit")}
                className={`py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  manualForm.type === "Credit"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FaArrowDown className="text-emerald-600" />
                Credit (+ Add Funds)
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange("Debit")}
                className={`py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  manualForm.type === "Debit"
                    ? "bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20 shadow-xs"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <FaArrowUp className="text-rose-600" />
                Debit (- Deduct Funds)
              </button>
            </div>
          </div>

          {/* Amount and Live Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Amount (INR ₹)"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={manualForm.amount}
                onChange={(e) => {
                  setManualForm({ ...manualForm, amount: e.target.value });
                  if (formErrors.amount) setFormErrors({ ...formErrors, amount: null });
                }}
                error={formErrors.amount}
              />
            </div>

            {/* Live New Balance Preview */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Projected New Balance
              </span>
              <p className="text-base font-bold font-mono text-gray-900 mt-0.5">
                {(() => {
                  const current = selectedUserObj ? Number(selectedUserObj.balance || 0) : 0;
                  const amt = Number(manualForm.amount) || 0;
                  const calculated =
                    manualForm.type === "Credit"
                      ? current + amt
                      : Math.max(0, current - amt);
                  return `₹${calculated.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`;
                })()}
              </p>
              {selectedUserObj && (
                <span className="text-[10px] text-gray-400">
                  Current: ₹{Number(selectedUserObj.balance || 0).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Payment Method / Channel */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Payment Channel / Origin
            </label>
            <select
              value={manualForm.method}
              onChange={(e) => setManualForm({ ...manualForm, method: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {manualForm.type === "Credit" ? (
                <>
                  <option value="Manual Admin Credit">Manual Admin Credit</option>
                  <option value="Offline Bank Transfer (NEFT/IMPS)">
                    Offline Bank Transfer (NEFT/IMPS/RTGS)
                  </option>
                  <option value="Cash / Offline Deposit">Cash / Offline Deposit</option>
                  <option value="Customer Support Resolution">
                    Customer Support Resolution
                  </option>
                  <option value="Promotional / Bonus Credit">
                    Promotional / Incentive Bonus
                  </option>
                </>
              ) : (
                <>
                  <option value="Manual Admin Debit">Manual Admin Debit</option>
                  <option value="Balance Penalty Correction">
                    Balance Penalty / Correction
                  </option>
                  <option value="Dispute Chargeback">Dispute Chargeback</option>
                  <option value="Administrative Adjustment">
                    Administrative Deduction
                  </option>
                </>
              )}
            </select>
          </div>

          {/* Reference ID (Optional) */}
          <Input
            label="Transaction Reference / Receipt ID (Optional)"
            placeholder="e.g. UTR-92810398 or ADM-REC-102"
            value={manualForm.refId}
            onChange={(e) => setManualForm({ ...manualForm, refId: e.target.value })}
          />

          {/* Reason / Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason / Ledger Remark <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Received offline NEFT bank payment with UTR #9910283, credited to customer wallet."
              value={manualForm.reason}
              onChange={(e) => {
                setManualForm({ ...manualForm, reason: e.target.value });
                if (formErrors.reason) setFormErrors({ ...formErrors, reason: null });
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.reason ? "border-rose-500" : "border-gray-300"
              }`}
            />
            {formErrors.reason && (
              <p className="text-xs text-rose-500 mt-1">{formErrors.reason}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Modal 2: Transaction Details Drawer / Modal */}
      {/* ------------------------------------------------------------- */}
      {selectedTxn && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={`Transaction Details — ${selectedTxn.id}`}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {(selectedTxn.status || "").toLowerCase().includes("pending") && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        setDetailsModalOpen(false);
                        handleApproveClick(selectedTxn);
                      }}
                      icon={<FaCheckCircle />}
                    >
                      Approve & Credit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setDetailsModalOpen(false);
                        handleRejectClick(selectedTxn);
                      }}
                      icon={<FaTimesCircle />}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close Window
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Header Tags */}
            <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-blue-600">
                  {selectedTxn.id}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    (selectedTxn.type || "").toLowerCase().includes("credit") ||
                    (selectedTxn.type || "").toLowerCase().includes("deposit")
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : (selectedTxn.type || "").toLowerCase().includes("debit")
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  }`}
                >
                  {selectedTxn.type}
                </span>
              </div>
              <Badge status={selectedTxn.status} size="sm" />
            </div>

            {/* Financial Card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Gross Amount
                </span>
                <p className="text-lg font-bold font-mono text-gray-900 mt-0.5">
                  ₹{Number(selectedTxn.amount || 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Gateway Fee
                </span>
                <p className="text-lg font-bold font-mono text-gray-600 mt-0.5">
                  ₹{Number(selectedTxn.fee || 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  Net Credited
                </span>
                <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                  ₹{Number(selectedTxn.netAmount || selectedTxn.amount || 0).toLocaleString(
                    "en-IN",
                    { minimumFractionDigits: 2 }
                  )}
                </p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <FaUser className="text-blue-500" />
                <span>Customer Information</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-gray-400">Account Name:</span>
                  <p className="font-semibold text-gray-900">{selectedTxn.user}</p>
                </div>
                <div>
                  <span className="text-gray-400">Email Address:</span>
                  <p className="font-semibold text-gray-900">
                    {selectedTxn.userEmail || "Not Provided"}
                  </p>
                </div>
                {selectedTxn.userId && (
                  <div>
                    <span className="text-gray-400">User ID:</span>
                    <p className="font-mono text-gray-700">{selectedTxn.userId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Channel & Gateway References */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <FaMoneyBillWave className="text-emerald-500" />
                <span>Payment Channel & Reference</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-gray-400">Payment Gateway / Method:</span>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {selectedTxn.method}
                  </p>
                </div>

                <div>
                  <span className="text-gray-400">Timestamp:</span>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
                    <FaClock className="text-gray-400" />
                    {selectedTxn.createdAt || selectedTxn.date || "N/A"}
                  </p>
                </div>
              </div>

              {selectedTxn.refId && (
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 block text-[11px]">
                      Gateway Ref / UTR / Order ID:
                    </span>
                    <span className="font-mono font-bold text-xs text-gray-900">
                      {selectedTxn.refId}
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleCopyRef(selectedTxn.refId)}
                    icon={copiedRef ? <FaCheck className="text-emerald-600" /> : <FaCopy />}
                  >
                    {copiedRef ? "Copied" : "Copy Ref"}
                  </Button>
                </div>
              )}
            </div>

            {/* Description / Remarks */}
            {selectedTxn.description && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Description / Remarks
                </span>
                <p className="text-gray-700 leading-relaxed">{selectedTxn.description}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Confirmation Dialog for Approvals / Rejections */}
      {/* ------------------------------------------------------------- */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          !confirmDialog.isLoading &&
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        isLoading={confirmDialog.isLoading}
      />
    </AdminLayout>
  );
}

export default AdminFinance;
