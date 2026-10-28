/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheck,
  FaBan,
  FaTag,
  FaCheckCircle,
  FaClock,
  FaHistory,
  FaSync,
  FaTimes,
  FaExclamationTriangle,
  FaPercent,
  FaRupeeSign,
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

const STATUS_TABS = ["all", "Active", "Expired", "Disabled"];

// Helper function to derive effective status without mutating source record
const getCouponEffectiveStatus = (coupon) => {
  if (!coupon) return "Disabled";
  if (coupon.status === "Disabled") return "Disabled";

  if (coupon.expiresAt) {
    const expiry = new Date(coupon.expiresAt);
    expiry.setHours(23, 59, 59, 999);
    if (expiry.getTime() < Date.now()) {
      return "Expired";
    }
  }

  return "Active";
};

function AdminCoupons() {
  const { addToast } = useToast();

  // Primary State
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Client Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Action States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage",
    value: "10",
    minSpend: "500",
    maxDiscount: "200",
    usageLimit: "100",
    expiresAt: "2026-12-31",
    status: "Active",
  });
  const [formErrors, setFormErrors] = useState({});

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchCoupons = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      const data = await adminService.getCoupons();
      setCoupons(Array.isArray(data) ? data : []);
      if (isManualRefresh) {
        addToast("Coupons list refreshed", "success");
      }
    } catch (err) {
      console.error("Failed to load coupons:", err);
      setFetchError("Unable to load coupons list. Please retry.");
      addToast("Failed to load coupons", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // -------------------------------------------------------------
  // Filter & Search Handlers (with page reset)
  // -------------------------------------------------------------
  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (tab) => {
    setStatusFilter(tab);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";

  // -------------------------------------------------------------
  // Summary Metrics (derived from coupon records)
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const total = coupons.length;
    const active = coupons.filter((c) => getCouponEffectiveStatus(c) === "Active").length;
    const expired = coupons.filter((c) => getCouponEffectiveStatus(c) === "Expired").length;
    const disabled = coupons.filter((c) => getCouponEffectiveStatus(c) === "Disabled").length;
    const totalRedemptions = coupons.reduce((acc, c) => {
      const used = Number(c.usedCount) || Number(c.used) || 0;
      return acc + used;
    }, 0);

    return { total, active, expired, disabled, totalRedemptions };
  }, [coupons]);

  // -------------------------------------------------------------
  // Filtered & Paginated Coupons
  // -------------------------------------------------------------
  const filteredCoupons = useMemo(() => {
    const query = search.trim().toUpperCase();

    return coupons.filter((c) => {
      const codeStr = String(c.code || "").toUpperCase();
      const typeStr = String(c.type || "").toUpperCase();
      const valStr = String(c.value || "");

      const matchesSearch =
        !query ||
        codeStr.includes(query) ||
        typeStr.includes(query) ||
        valStr.includes(query);

      const effectiveStatus = getCouponEffectiveStatus(c);
      const matchesStatus =
        statusFilter === "all" ||
        effectiveStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [coupons, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCoupons = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredCoupons.slice(startIndex, startIndex + pageSize);
  }, [filteredCoupons, safeCurrentPage, pageSize]);

  // -------------------------------------------------------------
  // Modal Open Handlers
  // -------------------------------------------------------------
  const handleOpenAdd = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      type: "percentage",
      value: "10",
      minSpend: "500",
      maxDiscount: "200",
      usageLimit: "100",
      expiresAt: "2026-12-31",
      status: "Active",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (cpn) => {
    setEditingCoupon(cpn);
    setFormData({
      code: cpn.code || "",
      type: cpn.type || "percentage",
      value: String(cpn.value ?? 10),
      minSpend: String(cpn.minSpend ?? 0),
      maxDiscount: String(cpn.maxDiscount ?? 0),
      usageLimit: String(cpn.usageLimit ?? 100),
      expiresAt: cpn.expiresAt || "2026-12-31",
      status: cpn.status || "Active",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // -------------------------------------------------------------
  // Form Field Change Handlers with Validation Cleaning
  // -------------------------------------------------------------
  const handleCodeChange = (e) => {
    const cleanCode = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    setFormData((prev) => ({ ...prev, code: cleanCode }));
    if (formErrors.code) {
      setFormErrors((prev) => ({ ...prev, code: null }));
    }
  };

  const handleFieldChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // -------------------------------------------------------------
  // Form Validation & Submission
  // -------------------------------------------------------------
  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};

    const cleanCode = formData.code.trim().toUpperCase();

    // 1. Code Validation
    if (!cleanCode) {
      errors.code = "Coupon code is required";
    } else if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      errors.code = "Code can only contain uppercase letters, numbers, hyphens, and underscores";
    } else if (cleanCode.length < 3) {
      errors.code = "Coupon code must be at least 3 characters long";
    }

    // 2. Duplicate Code Check
    const duplicate = coupons.find(
      (c) =>
        c.code.trim().toUpperCase() === cleanCode &&
        (!editingCoupon || c.id !== editingCoupon.id)
    );
    if (duplicate) {
      errors.code = `Coupon code '${cleanCode}' already exists`;
    }

    // 3. Discount Value Validation
    const valNum = Number(formData.value);
    if (isNaN(valNum) || valNum <= 0) {
      errors.value = "Discount value must be greater than 0";
    } else if (formData.type === "percentage" && valNum > 100) {
      errors.value = "Percentage discount cannot exceed 100%";
    }

    // 4. Minimum Spend & Max Discount
    const minSpendNum = Number(formData.minSpend);
    if (isNaN(minSpendNum) || minSpendNum < 0) {
      errors.minSpend = "Minimum spend cannot be negative";
    }

    const maxDiscountNum = Number(formData.maxDiscount);
    if (isNaN(maxDiscountNum) || maxDiscountNum < 0) {
      errors.maxDiscount = "Maximum discount cap cannot be negative";
    }

    // 5. Usage Limit Validation
    const limitNum = Number(formData.usageLimit);
    if (isNaN(limitNum) || limitNum < 1 || !Number.isInteger(limitNum)) {
      errors.usageLimit = "Usage limit must be a positive whole integer";
    } else if (editingCoupon) {
      const currentUsed = Number(editingCoupon.usedCount) || Number(editingCoupon.used) || 0;
      if (limitNum < currentUsed) {
        errors.usageLimit = `Usage limit cannot be lower than current redemptions (${currentUsed})`;
      }
    }

    // 6. Expiry Date Validation
    if (!formData.expiresAt) {
      errors.expiresAt = "Expiry date is required";
    } else {
      const expiryDate = new Date(formData.expiresAt);
      if (isNaN(expiryDate.getTime())) {
        errors.expiresAt = "Please provide a valid expiry date";
      } else if (!editingCoupon && formData.status === "Active") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiryDate < today) {
          errors.expiresAt = "Expiry date cannot be in the past for an Active coupon";
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstMsg = Object.values(errors)[0];
      addToast(firstMsg, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: cleanCode,
        type: formData.type,
        value: valNum,
        minSpend: minSpendNum || 0,
        maxDiscount: maxDiscountNum || 0,
        usageLimit: limitNum,
        expiresAt: formData.expiresAt,
        status: formData.status,
      };

      if (editingCoupon) {
        const updated = await adminService.updateCoupon(editingCoupon.id, payload);
        setCoupons((prev) =>
          prev.map((c) => (c.id === editingCoupon.id ? { ...c, ...updated } : c))
        );
        addToast(`Coupon '${cleanCode}' updated successfully`, "success");
      } else {
        const created = await adminService.createCoupon(payload);
        setCoupons((prev) => [created, ...prev]);
        addToast(`Coupon '${cleanCode}' created successfully`, "success");
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Save coupon error:", err);
      addToast("Failed to save coupon", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Enable / Disable Status Toggle
  // -------------------------------------------------------------
  const handleToggleStatus = async (cpn) => {
    if (togglingId) return;

    const currentEffective = getCouponEffectiveStatus(cpn);
    const nextStatus = currentEffective === "Disabled" ? "Active" : "Disabled";

    setTogglingId(cpn.id);
    try {
      await adminService.updateCouponStatus(cpn.id, nextStatus);
      setCoupons((prev) =>
        prev.map((c) => (c.id === cpn.id ? { ...c, status: nextStatus } : c))
      );
      addToast(
        `Coupon '${cpn.code}' is now ${nextStatus === "Active" ? "Enabled" : "Disabled"}`,
        "success"
      );
    } catch (err) {
      console.error("Status toggle error:", err);
      addToast("Failed to update coupon status", "error");
    } finally {
      setTogglingId(null);
    }
  };

  // -------------------------------------------------------------
  // Delete Coupon Handlers
  // -------------------------------------------------------------
  const handleDelete = async () => {
    const { item } = deleteConfirm;
    if (!item) return;

    setIsSubmitting(true);
    try {
      await adminService.deleteCoupon(item.id);
      setCoupons((prev) => prev.filter((c) => c.id !== item.id));
      addToast(`Coupon '${item.code}' deleted permanently`, "success");
    } catch (err) {
      console.error("Delete coupon error:", err);
      addToast("Failed to delete coupon", "error");
    } finally {
      setIsSubmitting(false);
      setDeleteConfirm({ isOpen: false, item: null });
    }
  };

  // -------------------------------------------------------------
  // Reusable DataTable Column Definitions
  // -------------------------------------------------------------
  const columns = [
    {
      header: "Coupon Code",
      accessor: "code",
      sortable: true,
      className: "w-44",
      render: (row) => (
        <div className="flex items-center gap-2 font-mono">
          <span className="font-bold text-sm bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 tracking-wider">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Discount Value",
      accessor: "value",
      sortable: true,
      render: (row) => {
        const isPercent = row.type === "percentage";
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span
              className={`p-1.5 rounded-md ${
                isPercent ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {isPercent ? <FaPercent className="text-[10px]" /> : <FaRupeeSign className="text-[10px]" />}
            </span>
            <span className="text-gray-900 font-bold">
              {isPercent ? `${row.value}% OFF` : `₹${row.value} FLAT`}
            </span>
          </div>
        );
      },
    },
    {
      header: "Min Spend / Max Cap",
      accessor: "minSpend",
      render: (row) => (
        <div className="text-xs text-gray-700 font-mono space-y-0.5">
          <div>
            <span className="text-gray-400">Min:</span>{" "}
            <span className="font-semibold text-gray-900">
              {row.minSpend ? `₹${Number(row.minSpend).toLocaleString()}` : "None"}
            </span>
          </div>
          {row.type === "percentage" && row.maxDiscount > 0 && (
            <div>
              <span className="text-gray-400">Cap:</span>{" "}
              <span className="font-semibold text-gray-900">
                ₹{Number(row.maxDiscount).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Usage / Limit",
      accessor: "usedCount",
      sortable: true,
      render: (row) => {
        const used = Number(row.usedCount) || Number(row.used) || 0;
        const limit = Number(row.usageLimit) || 1;
        const pct = Math.min(100, Math.round((used / limit) * 100));
        const isMaxed = used >= limit;

        return (
          <div className="w-32 space-y-1 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-gray-800">
                {used} / {limit}
              </span>
              <span className="text-[10px] text-gray-500">{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isMaxed ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-blue-600"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {isMaxed && (
              <span className="inline-block text-[10px] text-rose-600 font-semibold uppercase">
                Maxed Out
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Expiry Date",
      accessor: "expiresAt",
      sortable: true,
      className: "text-xs font-mono text-gray-600",
      render: (row) => {
        const effective = getCouponEffectiveStatus(row);
        const isExpired = effective === "Expired";

        return (
          <div>
            <span className={isExpired ? "text-rose-600 font-semibold line-through" : "text-gray-800"}>
              {row.expiresAt || "Never"}
            </span>
            {isExpired && (
              <p className="text-[10px] text-rose-500 font-sans font-semibold">Expired</p>
            )}
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: "status",
      sortable: true,
      render: (row) => {
        const effective = getCouponEffectiveStatus(row);
        return <Badge status={effective} size="xs" />;
      },
    },
    {
      header: "Actions",
      accessor: "actions",
      className: "text-right",
      render: (row) => {
        const effective = getCouponEffectiveStatus(row);
        const isToggling = togglingId === row.id;

        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="xs"
              variant="outline"
              title="Edit Coupon"
              onClick={() => handleOpenEdit(row)}
              icon={<FaEdit className="text-blue-600" />}
            />

            <Button
              size="xs"
              variant={effective === "Active" ? "outline" : "success"}
              title={effective === "Active" ? "Disable Coupon" : "Enable Coupon"}
              onClick={() => handleToggleStatus(row)}
              disabled={isToggling}
              icon={
                isToggling ? (
                  <FaSync className="animate-spin text-gray-500" />
                ) : effective === "Active" ? (
                  <FaBan className="text-amber-600" />
                ) : (
                  <FaCheck className="text-white" />
                )
              }
            />

            <Button
              size="xs"
              variant="danger"
              title="Delete Coupon"
              onClick={() => setDeleteConfirm({ isOpen: true, item: row })}
              icon={<FaTrash />}
            />
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
            Coupons & Discounts
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Create promotional codes, percentage or flat discounts, and manage usage thresholds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCoupons(true)}
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
            Create Coupon
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div
          onClick={() => handleStatusFilterChange("all")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusFilter === "all" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Coupons</p>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-0.5 font-mono">
                {metrics.total}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
              <FaTag />
            </div>
          </div>
        </div>

        <div
          onClick={() => handleStatusFilterChange("Active")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusFilter === "Active" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Coupons</p>
              <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 font-mono">
                {metrics.active}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
              <FaCheckCircle />
            </div>
          </div>
        </div>

        <div
          onClick={() => handleStatusFilterChange("Expired")}
          className={`bg-white rounded-xl p-4 border transition cursor-pointer shadow-xs ${
            statusFilter === "Expired" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expired</p>
              <h3 className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 font-mono">
                {metrics.expired}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-lg shrink-0">
              <FaClock />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Redemptions</p>
            <h3 className="text-xl sm:text-2xl font-black text-purple-700 mt-0.5 font-mono">
              {metrics.totalRedemptions}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
            <FaHistory />
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
          <Button variant="danger" size="xs" onClick={() => fetchCoupons(true)}>
            Retry
          </Button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 hide-scrollbar">
        {STATUS_TABS.map((tab) => {
          const count =
            tab === "all"
              ? coupons.length
              : coupons.filter((c) => getCouponEffectiveStatus(c) === tab).length;

          return (
            <button
              key={tab}
              onClick={() => handleStatusFilterChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <span>{tab === "all" ? "All Coupons" : tab}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  statusFilter === tab ? "bg-blue-700/80 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main DataTable */}
      <DataTable
        columns={columns}
        data={paginatedCoupons}
        isLoading={loading}
        searchPlaceholder="Search coupon code or discount..."
        searchValue={search}
        onSearch={handleSearchChange}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
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
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2 py-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              >
                <FaTimes className="text-[10px]" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        }
        emptyTitle={hasActiveFilters ? "No matching coupons found" : "No coupons created yet"}
        emptySubtitle={
          hasActiveFilters
            ? "Try adjusting your search terms or clearing status filters."
            : "Click 'Create Coupon' above to configure your first promotional discount code."
        }
        pagination={{
          page: safeCurrentPage,
          pageSize: pageSize,
          totalItems: filteredCoupons.length,
          totalPages: totalPages,
          onPageChange: (newPage) => setCurrentPage(newPage),
        }}
      />

      {/* ========================================================= */}
      {/* CREATE / EDIT COUPON MODAL                                */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create Promotional Coupon"}
        subtitle="Set discount values, minimum spends, and expiration terms"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
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
              {editingCoupon ? "Save Changes" : "Create Coupon"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Coupon Code Input */}
          <div>
            <Input
              label="Coupon Code"
              required
              placeholder="e.g. FLASH50, WELCOME2026"
              value={formData.code}
              onChange={handleCodeChange}
            />
            {formErrors.code && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.code}</p>
            )}
          </div>

          {/* Discount Type & Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Discount Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleFieldChange("type", e.target.value)}
                className="w-full py-2 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
              >
                <option value="percentage">Percentage Discount (%)</option>
                <option value="flat">Flat Cash Discount (₹)</option>
              </select>
            </div>

            <div>
              <Input
                label={formData.type === "percentage" ? "Discount Percentage (%)" : "Flat Amount (₹)"}
                type="number"
                required
                min="1"
                max={formData.type === "percentage" ? "100" : undefined}
                value={formData.value}
                onChange={(e) => handleFieldChange("value", e.target.value)}
              />
              {formErrors.value && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.value}</p>
              )}
            </div>
          </div>

          {/* Min Spend & Max Discount Cap */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Minimum Spend Threshold (₹)"
                type="number"
                min="0"
                placeholder="0 for no minimum"
                value={formData.minSpend}
                onChange={(e) => handleFieldChange("minSpend", e.target.value)}
              />
              {formErrors.minSpend && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.minSpend}</p>
              )}
            </div>

            <div>
              <Input
                label="Max Discount Cap (₹)"
                type="number"
                min="0"
                placeholder="0 for unlimited"
                value={formData.maxDiscount}
                disabled={formData.type === "flat"}
                onChange={(e) => handleFieldChange("maxDiscount", e.target.value)}
              />
              {formErrors.maxDiscount && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.maxDiscount}</p>
              )}
            </div>
          </div>

          {/* Usage Limit & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Total Usage / Redemption Limit"
                type="number"
                required
                min="1"
                value={formData.usageLimit}
                onChange={(e) => handleFieldChange("usageLimit", e.target.value)}
              />
              {formErrors.usageLimit && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.usageLimit}</p>
              )}
            </div>

            <div>
              <Input
                label="Expiry Date"
                type="date"
                required
                value={formData.expiresAt}
                onChange={(e) => handleFieldChange("expiresAt", e.target.value)}
              />
              {formErrors.expiresAt && (
                <p className="text-rose-600 text-[11px] mt-1 font-medium">{formErrors.expiresAt}</p>
              )}
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleFieldChange("status", e.target.value)}
              className="w-full py-2 px-3 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
            >
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION DIALOG                                */}
      {/* ========================================================= */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, item: null })}
        onConfirm={handleDelete}
        title="Delete Coupon"
        message={
          deleteConfirm.item
            ? `Are you sure you want to permanently delete coupon '${deleteConfirm.item.code}'?${
                (Number(deleteConfirm.item.usedCount) || Number(deleteConfirm.item.used) || 0) > 0
                  ? ` Warning: This coupon has already been redeemed ${
                      Number(deleteConfirm.item.usedCount) || Number(deleteConfirm.item.used)
                    } time(s).`
                  : ""
              }`
            : "Are you sure you want to delete this coupon?"
        }
        confirmText="Delete Coupon"
        variant="danger"
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}

export default AdminCoupons;
