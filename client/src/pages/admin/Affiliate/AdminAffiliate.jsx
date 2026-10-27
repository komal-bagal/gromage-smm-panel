/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaPlus,
  FaEdit,
  FaSync,
  FaCheckCircle,
  FaCheck,
  FaBan,
  FaCopy,
  FaUsers,
  FaMoneyBillWave,
  FaSlidersH,
  FaPercent,
  FaHandHoldingUsd,
  FaTimesCircle,
  FaEye,
  FaLink,
  FaExchangeAlt,
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

const PARTNER_STATUS_TABS = ["all", "Active", "Disabled"];
const PAYOUT_STATUS_TABS = ["all", "Pending", "Approved", "Rejected"];

function AdminAffiliate() {
  const { addToast } = useToast();

  // Primary Data State
  const [data, setData] = useState(null);
  const [affiliates, setAffiliates] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Active View Tab: 'partners' | 'payouts' | 'settings'
  const [activeTab, setActiveTab] = useState("partners");

  // Partners Filter & Pagination State
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerStatusFilter, setPartnerStatusFilter] = useState("all");
  const [partnerCurrentPage, setPartnerCurrentPage] = useState(1);
  const partnerPageSize = 10;

  // Payouts Filter State
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("all");

  // Modals & Action States
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [addEditModalOpen, setAddEditModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [isSubmittingPartner, setIsSubmittingPartner] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [payoutActionLoading, setPayoutActionLoading] = useState({});
  const [copiedCode, setCopiedCode] = useState(null);

  // Commission Settings Form State
  const [settings, setSettings] = useState({
    commissionRate: 5,
    minPayout: 500,
    cookieDays: 30,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Partner Form State
  const [partnerForm, setPartnerForm] = useState({
    user: "",
    email: "",
    referralCode: "",
    commissionRate: "5",
    status: "Active",
  });
  const [partnerFormErrors, setPartnerFormErrors] = useState({});

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmVariant: "primary",
    confirmText: "Confirm",
    onConfirm: () => {},
  });

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchAffiliateData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const res = await adminService.getAffiliateData();
        setData(res);
        setAffiliates(Array.isArray(res?.affiliates) ? res.affiliates : []);
        setPayoutRequests(
          Array.isArray(res?.payoutRequests) ? res.payoutRequests : []
        );
        setSettings({
          commissionRate: res.commissionRate ?? 5,
          minPayout: res.minPayout ?? 500,
          cookieDays: res.cookieDays ?? 30,
        });

        if (isManualRefresh) {
          addToast("Affiliate data refreshed", "success");
        }
      } catch (err) {
        console.error("Failed to load affiliate data:", err);
        setFetchError("Failed to load affiliate data. Please try again.");
        addToast("Failed to load affiliate data", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchAffiliateData();
  }, [fetchAffiliateData]);

  // -------------------------------------------------------------
  // Clipboard Copy Helper
  // -------------------------------------------------------------
  const handleCopyCode = (code, label = "Referral code") => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    addToast(`${label} "${code}" copied to clipboard`, "info");
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2500);
  };

  // -------------------------------------------------------------
  // Settings Handler
  // -------------------------------------------------------------
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (settings.commissionRate < 0 || settings.commissionRate > 100) {
      addToast("Commission rate must be between 0% and 100%", "warning");
      return;
    }
    if (settings.minPayout < 1) {
      addToast("Minimum payout threshold must be at least ₹1", "warning");
      return;
    }

    setIsSavingSettings(true);
    try {
      await adminService.updateAffiliateSettings(settings);
      setData((prev) => ({
        ...prev,
        commissionRate: settings.commissionRate,
        minPayout: settings.minPayout,
        cookieDays: settings.cookieDays,
      }));
      addToast("Affiliate settings saved successfully", "success");
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // -------------------------------------------------------------
  // Payout Actions
  // -------------------------------------------------------------
  const handleApprovePayout = async (payId) => {
    setPayoutActionLoading((prev) => ({ ...prev, [payId]: true }));
    try {
      await adminService.approvePayoutRequest(payId);
      setPayoutRequests((prev) =>
        prev.map((p) => (p.id === payId ? { ...p, status: "Approved" } : p))
      );
      // Recalculate pending metrics
      setData((prev) => {
        const target = prev?.payoutRequests?.find((p) => p.id === payId);
        const amountNum = target?.numericAmount || 0;
        const currentPendingNum = parseInt(
          prev?.pendingPayouts?.replace(/[^0-9]/g, "") || "0",
          10
        );
        return {
          ...prev,
          payoutRequests: prev?.payoutRequests?.map((p) =>
            p.id === payId ? { ...p, status: "Approved" } : p
          ),
          pendingPayouts: `₹${Math.max(
            0,
            currentPendingNum - amountNum
          ).toLocaleString("en-IN")}`,
        };
      });
      addToast(`Payout #${payId} approved successfully`, "success");
    } catch {
      addToast("Failed to approve payout request", "error");
    } finally {
      setPayoutActionLoading((prev) => ({ ...prev, [payId]: false }));
    }
  };

  const handleRejectPayout = async (payId) => {
    setPayoutActionLoading((prev) => ({ ...prev, [payId]: true }));
    try {
      await adminService.rejectPayoutRequest(payId);
      setPayoutRequests((prev) =>
        prev.map((p) => (p.id === payId ? { ...p, status: "Rejected" } : p))
      );
      addToast(`Payout #${payId} rejected`, "info");
    } catch {
      addToast("Failed to reject payout request", "error");
    } finally {
      setPayoutActionLoading((prev) => ({ ...prev, [payId]: false }));
    }
  };

  // -------------------------------------------------------------
  // Partner Status Toggle
  // -------------------------------------------------------------
  const handleTogglePartnerStatus = async (partner) => {
    const newStatus = partner.status === "Active" ? "Disabled" : "Active";
    setTogglingId(partner.id);

    try {
      await adminService.updateAffiliateStatus(partner.id, newStatus);
      setAffiliates((prev) =>
        prev.map((a) => (a.id === partner.id ? { ...a, status: newStatus } : a))
      );
      if (selectedPartner && selectedPartner.id === partner.id) {
        setSelectedPartner((prev) => ({ ...prev, status: newStatus }));
      }
      addToast(
        `Partner "${partner.user}" status updated to ${newStatus}`,
        "success"
      );
    } catch {
      addToast("Failed to update partner status", "error");
    } finally {
      setTogglingId(null);
    }
  };

  // -------------------------------------------------------------
  // Partner Add / Edit Modal Handlers
  // -------------------------------------------------------------
  const handleOpenAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm({
      user: "",
      email: "",
      referralCode: "",
      commissionRate: String(settings.commissionRate || 5),
      status: "Active",
    });
    setPartnerFormErrors({});
    setAddEditModalOpen(true);
  };

  const handleOpenEditPartner = (partner) => {
    setEditingPartner(partner);
    setPartnerForm({
      user: partner.user || "",
      email: partner.email || "",
      referralCode: partner.referralCode || "",
      commissionRate: String(partner.commissionRate || settings.commissionRate || 5),
      status: partner.status || "Active",
    });
    setPartnerFormErrors({});
    setAddEditModalOpen(true);
  };

  const validatePartnerForm = () => {
    const errors = {};
    if (!partnerForm.user.trim()) {
      errors.user = "Partner name / username is required";
    }

    if (!partnerForm.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerForm.email)) {
      errors.email = "Please enter a valid email address";
    }

    const code = partnerForm.referralCode.trim().toUpperCase();
    if (!code) {
      errors.referralCode = "Referral code is required";
    } else if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
      errors.referralCode =
        "Code must be 3-20 characters long (alphanumeric, -, _)";
    } else {
      // Check code uniqueness across other partners
      const duplicate = affiliates.find(
        (a) =>
          a.referralCode?.toUpperCase() === code &&
          (!editingPartner || a.id !== editingPartner.id)
      );
      if (duplicate) {
        errors.referralCode = `Referral code "${code}" is already assigned to ${duplicate.user}`;
      }
    }

    const rateNum = Number(partnerForm.commissionRate);
    if (
      partnerForm.commissionRate === "" ||
      isNaN(rateNum) ||
      rateNum < 1 ||
      rateNum > 100
    ) {
      errors.commissionRate = "Commission rate must be between 1% and 100%";
    }

    setPartnerFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitPartner = async (e) => {
    e.preventDefault();
    if (!validatePartnerForm()) return;

    setIsSubmittingPartner(true);
    try {
      const payload = {
        user: partnerForm.user.trim(),
        email: partnerForm.email.trim(),
        referralCode: partnerForm.referralCode.trim().toUpperCase(),
        commissionRate: Number(partnerForm.commissionRate),
        status: partnerForm.status,
      };

      if (editingPartner) {
        const updated = await adminService.updateAffiliate(
          editingPartner.id,
          payload
        );
        setAffiliates((prev) =>
          prev.map((a) => (a.id === editingPartner.id ? { ...a, ...updated } : a))
        );
        if (selectedPartner && selectedPartner.id === editingPartner.id) {
          setSelectedPartner((prev) => ({ ...prev, ...updated }));
        }
        addToast(`Partner "${payload.user}" updated successfully`, "success");
      } else {
        const created = await adminService.createAffiliate(payload);
        setAffiliates((prev) => [created, ...prev]);
        setData((prev) => ({
          ...prev,
          totalAffiliates: (prev?.totalAffiliates || 0) + 1,
          activeAffiliates:
            payload.status === "Active"
              ? (prev?.activeAffiliates || 0) + 1
              : prev?.activeAffiliates || 0,
        }));
        addToast(`Partner "${payload.user}" enrolled successfully`, "success");
      }

      setAddEditModalOpen(false);
    } catch {
      addToast("Failed to save affiliate partner", "error");
    } finally {
      setIsSubmittingPartner(false);
    }
  };

  // -------------------------------------------------------------
  // Filtered Partners
  // -------------------------------------------------------------
  const filteredAffiliates = useMemo(() => {
    let list = [...affiliates];

    if (partnerStatusFilter !== "all") {
      list = list.filter((a) => a.status === partnerStatusFilter);
    }

    if (partnerSearch.trim()) {
      const q = partnerSearch.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.user && a.user.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.referralCode && a.referralCode.toLowerCase().includes(q)) ||
          (a.id && a.id.toLowerCase().includes(q))
      );
    }

    return list;
  }, [affiliates, partnerStatusFilter, partnerSearch]);

  const paginatedAffiliates = useMemo(() => {
    const startIndex = (partnerCurrentPage - 1) * partnerPageSize;
    return filteredAffiliates.slice(startIndex, startIndex + partnerPageSize);
  }, [filteredAffiliates, partnerCurrentPage, partnerPageSize]);

  const partnerTotalPages = Math.ceil(
    filteredAffiliates.length / partnerPageSize
  );

  // -------------------------------------------------------------
  // Filtered Payout Requests
  // -------------------------------------------------------------
  const filteredPayoutRequests = useMemo(() => {
    let list = [...payoutRequests];

    if (payoutStatusFilter !== "all") {
      list = list.filter((p) => p.status === payoutStatusFilter);
    }

    if (payoutSearch.trim()) {
      const q = payoutSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          (p.id && p.id.toLowerCase().includes(q)) ||
          (p.user && p.user.toLowerCase().includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q)) ||
          (p.method && p.method.toLowerCase().includes(q)) ||
          (p.amount && p.amount.toLowerCase().includes(q))
      );
    }

    return list;
  }, [payoutRequests, payoutStatusFilter, payoutSearch]);

  // Counts for status badges
  const pendingPayoutsCount = useMemo(
    () => payoutRequests.filter((p) => p.status === "Pending").length,
    [payoutRequests]
  );

  // -------------------------------------------------------------
  // Partners Table Columns
  // -------------------------------------------------------------
  const partnerColumns = [
    {
      key: "id",
      label: "Partner ID",
      render: (row) => (
        <span className="font-mono font-bold text-blue-600 text-xs">
          {row.id}
        </span>
      ),
    },
    {
      key: "user",
      label: "Partner Details",
      render: (row) => (
        <div>
          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
            {row.user}
          </div>
          {row.email && (
            <div className="text-xs text-gray-500">{row.email}</div>
          )}
        </div>
      ),
    },
    {
      key: "referralCode",
      label: "Referral Code",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200 text-xs">
            {row.referralCode}
          </span>
          <button
            type="button"
            title="Copy referral code"
            onClick={() => handleCopyCode(row.referralCode, "Referral code")}
            className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 transition-colors"
          >
            {copiedCode === row.referralCode ? (
              <FaCheck className="text-emerald-600 text-xs" />
            ) : (
              <FaCopy className="text-xs" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: "referralCount",
      label: "Referrals / Converted",
      render: (row) => (
        <div>
          <div className="font-bold text-gray-900 text-xs">
            {row.referralCount || 0} clicks / signups
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            {row.conversionCount || 0} buyers (
            {row.referralCount
              ? Math.round(((row.conversionCount || 0) / row.referralCount) * 100)
              : 0}
            %)
          </div>
        </div>
      ),
    },
    {
      key: "commissionRate",
      label: "Commission Rate",
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <FaPercent className="text-[10px]" />
          {row.commissionRate ?? settings.commissionRate}%
        </span>
      ),
    },
    {
      key: "totalEarnings",
      label: "Total Earned / Pending",
      render: (row) => (
        <div>
          <div className="font-mono font-bold text-emerald-600 text-xs">
            ₹{(row.totalEarnings || 0).toLocaleString("en-IN")}
          </div>
          <div className="font-mono text-[11px] text-amber-600 font-medium">
            ₹{(row.pendingBalance || 0).toLocaleString("en-IN")} unpaid
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge status={row.status} size="xs" />,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            icon={<FaEye />}
            onClick={() => {
              setSelectedPartner(row);
              setDetailsModalOpen(true);
            }}
            title="View Partner Overview"
          >
            Details
          </Button>

          <Button
            size="xs"
            variant="secondary"
            icon={<FaEdit />}
            onClick={() => handleOpenEditPartner(row)}
            title="Edit Partner"
          >
            Edit
          </Button>

          <Button
            size="xs"
            variant={row.status === "Active" ? "danger" : "success"}
            icon={row.status === "Active" ? <FaBan /> : <FaCheck />}
            isLoading={togglingId === row.id}
            onClick={() => handleTogglePartnerStatus(row)}
            title={
              row.status === "Active"
                ? "Disable Partner"
                : "Activate Partner"
            }
          >
            {row.status === "Active" ? "Disable" : "Enable"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Affiliate Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Manage referral partners, commission rates, track earnings, and process withdrawal payout requests
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<FaSync />}
            isLoading={refreshing}
            onClick={() => fetchAffiliateData(true)}
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<FaPlus />}
            onClick={handleOpenAddPartner}
          >
            Add Partner
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Affiliates */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Total Affiliates
            </p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg text-sm">
              <FaUsers />
            </div>
          </div>
          <h3 className="text-2xl font-black text-gray-900 mt-2">
            {data?.totalAffiliates || affiliates.length || 0}
          </h3>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600">
              {data?.activeAffiliates ||
                affiliates.filter((a) => a.status === "Active").length ||
                0}{" "}
              active
            </span>{" "}
            partners enrolled
          </p>
        </div>

        {/* Total Referrals */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Total Referrals
            </p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm">
              <FaExchangeAlt />
            </div>
          </div>
          <h3 className="text-2xl font-black text-indigo-600 mt-2">
            {data?.totalReferrals ||
              affiliates.reduce((acc, a) => acc + (a.referralCount || 0), 0)}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Referred user registrations & clicks
          </p>
        </div>

        {/* Commissions Paid */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Commissions Paid
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm">
              <FaMoneyBillWave />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">
            {data?.paidCommissions || "₹0"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Successfully disbursed to partners
          </p>
        </div>

        {/* Pending Payouts */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Pending Payouts
            </p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg text-sm">
              <FaHandHoldingUsd />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 mt-2">
            {data?.pendingPayouts || "₹0"}
          </h3>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-amber-600">
              {pendingPayoutsCount} request{pendingPayoutsCount === 1 ? "" : "s"}
            </span>{" "}
            awaiting approval
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-4 pt-3 border-x shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab("partners")}
          className={`flex items-center gap-2 pb-3 px-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "partners"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FaUsers className="text-xs" />
          Affiliate Partners
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-bold">
            {affiliates.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payouts")}
          className={`flex items-center gap-2 pb-3 px-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "payouts"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FaHandHoldingUsd className="text-xs" />
          Withdrawal Requests
          {pendingPayoutsCount > 0 ? (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold animate-pulse">
              {pendingPayoutsCount} Pending
            </span>
          ) : (
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-bold">
              {payoutRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 pb-3 px-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "settings"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FaSlidersH className="text-xs" />
          Commission Settings
        </button>
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaTimesCircle className="text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{fetchError}</span>
          </div>
          <Button
            size="xs"
            variant="danger"
            onClick={() => fetchAffiliateData(true)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* TAB 1: PARTNERS */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <DataTable
            columns={partnerColumns}
            data={paginatedAffiliates}
            isLoading={loading}
            searchable={true}
            searchPlaceholder="Search by partner name, email, referral code, ID..."
            searchValue={partnerSearch}
            onSearch={(val) => {
              setPartnerSearch(val);
              setPartnerCurrentPage(1);
            }}
            filters={
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
                {PARTNER_STATUS_TABS.map((tab) => {
                  const count =
                    tab === "all"
                      ? affiliates.length
                      : affiliates.filter((a) => a.status === tab).length;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setPartnerStatusFilter(tab);
                        setPartnerCurrentPage(1);
                      }}
                      className={`px-3 py-1 rounded-md font-medium capitalize transition-all cursor-pointer ${
                        partnerStatusFilter === tab
                          ? "bg-white text-gray-900 shadow-xs font-semibold"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {tab} ({count})
                    </button>
                  );
                })}
              </div>
            }
            pagination={{
              currentPage: partnerCurrentPage,
              totalPages: partnerTotalPages || 1,
              pageSize: partnerPageSize,
              onPageChange: setPartnerCurrentPage,
              totalItems: filteredAffiliates.length,
            }}
            emptyTitle="No affiliate partners found"
            emptySubtitle={
              partnerSearch || partnerStatusFilter !== "all"
                ? "Try clearing your search query or status filter."
                : "Click 'Add Partner' to enroll your first referral affiliate."
            }
          />
        </div>
      )}

      {/* TAB 2: PAYOUT REQUESTS */}
      {activeTab === "payouts" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Top Bar with Filter & Search */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[240px] max-w-sm">
                <input
                  type="text"
                  placeholder="Search payout ID, user, method..."
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute left-3 top-2.5 text-gray-400 text-xs">
                  <FaLink />
                </span>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
                {PAYOUT_STATUS_TABS.map((tab) => {
                  const count =
                    tab === "all"
                      ? payoutRequests.length
                      : payoutRequests.filter((p) => p.status === tab).length;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPayoutStatusFilter(tab)}
                      className={`px-3 py-1 rounded-md font-medium capitalize transition-all cursor-pointer ${
                        payoutStatusFilter === tab
                          ? "bg-white text-gray-900 shadow-xs font-semibold"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {tab} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase font-semibold text-[11px] tracking-wider">
                  <th className="py-3 px-4">Payout ID</th>
                  <th className="py-3 px-4">Partner</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payout Method / Details</th>
                  <th className="py-3 px-4">Requested At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredPayoutRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="max-w-xs mx-auto">
                        <FaHandHoldingUsd className="text-3xl text-gray-300 mx-auto mb-2" />
                        <p className="font-semibold text-gray-900 text-sm">
                          No payout requests found
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          No withdrawal requests match your selected filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPayoutRequests.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                        {p.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {p.user}
                        </div>
                        {p.email && (
                          <div className="text-[11px] text-gray-500">
                            {p.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 text-sm">
                        {p.amount}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700 font-medium">
                        {p.method}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {p.requestedAt || "Recent"}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={p.status} size="xs" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {p.status === "Pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="xs"
                              variant="success"
                              isLoading={payoutActionLoading[p.id]}
                              onClick={() => handleApprovePayout(p.id)}
                              icon={<FaCheckCircle />}
                            >
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              isLoading={payoutActionLoading[p.id]}
                              onClick={() => handleRejectPayout(p.id)}
                              icon={<FaBan />}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium italic">
                            Processed ({p.status})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COMMISSION SETTINGS */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Global Commission & Payout Rules
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Configure default affiliate parameters applied across all newly registered referral partners
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Default Commission Rate (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  required
                  value={settings.commissionRate}
                  helperText="Percentage rewarded on every referred user wallet deposit or order"
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      commissionRate: Number(e.target.value),
                    })
                  }
                />

                <Input
                  label="Minimum Payout Threshold (₹)"
                  type="number"
                  min="100"
                  step="50"
                  required
                  value={settings.minPayout}
                  helperText="Minimum balance an affiliate must accrue before requesting withdrawal"
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minPayout: Number(e.target.value),
                    })
                  }
                />
              </div>

              <Input
                label="Referral Cookie Lifetime (Days)"
                type="number"
                min="1"
                max="365"
                value={settings.cookieDays}
                helperText="Duration after initial link click during which conversions credit to the affiliate"
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cookieDays: Number(e.target.value),
                  })
                }
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={<FaCheckCircle />}
                  isLoading={isSavingSettings}
                >
                  Save Commission Settings
                </Button>
              </div>
            </form>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-6 space-y-4">
            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <FaInfoCircle className="text-blue-600" />
              Affiliate Policy Guide
            </h4>
            <ul className="text-xs text-blue-800/90 space-y-2.5 list-disc list-inside">
              <li>
                <strong>Custom Rates:</strong> You can override the commission
                rate individually per partner in the partners table.
              </li>
              <li>
                <strong>Cookie Tracking:</strong> Clicks are tracked securely via
                referral cookies until expiration.
              </li>
              <li>
                <strong>Automatic Accounting:</strong> Approved payout requests
                automatically deduct from the partner pending balance.
              </li>
              <li>
                <strong>Anti-Fraud:</strong> Self-referrals and duplicate IP
                registrations are automatically flagged.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* PARTNER DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <FaUsers className="text-blue-600" />
            <span>Partner Overview: {selectedPartner?.user}</span>
          </div>
        }
        size="lg"
      >
        {selectedPartner && (
          <div className="space-y-6">
            {/* Header Badge Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 block">
                  {selectedPartner.id}
                </span>
                <h4 className="text-lg font-bold text-gray-900">
                  {selectedPartner.user}
                </h4>
                <p className="text-xs text-gray-500">{selectedPartner.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={selectedPartner.status} size="sm" />
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {selectedPartner.commissionRate ?? settings.commissionRate}%
                  Commission
                </span>
              </div>
            </div>

            {/* Referral Link Box */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
              <label className="text-xs font-semibold text-gray-700 block">
                Partner Referral Link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 font-mono text-xs text-gray-800 truncate select-all">
                  https://gromage.com/ref/{selectedPartner.referralCode}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={
                    copiedCode === selectedPartner.referralCode ? (
                      <FaCheck className="text-emerald-600" />
                    ) : (
                      <FaCopy />
                    )
                  }
                  onClick={() =>
                    handleCopyCode(
                      `https://gromage.com/ref/${selectedPartner.referralCode}`,
                      "Referral link"
                    )
                  }
                >
                  {copiedCode === selectedPartner.referralCode
                    ? "Copied"
                    : "Copy Link"}
                </Button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-semibold block uppercase">
                  Total Clicks / Signups
                </span>
                <span className="text-lg font-black text-gray-900 block mt-1">
                  {selectedPartner.referralCount || 0}
                </span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-semibold block uppercase">
                  Paying Buyers
                </span>
                <span className="text-lg font-black text-emerald-600 block mt-1">
                  {selectedPartner.conversionCount || 0}
                </span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-semibold block uppercase">
                  Total Earnings
                </span>
                <span className="text-lg font-black font-mono text-blue-600 block mt-1">
                  ₹{(selectedPartner.totalEarnings || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-semibold block uppercase">
                  Unpaid Balance
                </span>
                <span className="text-lg font-black font-mono text-amber-600 block mt-1">
                  ₹
                  {(selectedPartner.pendingBalance || 0).toLocaleString(
                    "en-IN"
                  )}
                </span>
              </div>
            </div>

            {/* Meta details */}
            <div className="text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
              <span>
                Joined on:{" "}
                <strong>{selectedPartner.joinedAt || "2026-06-01"}</strong>
              </span>
              <span>
                Lifetime Disbursed:{" "}
                <strong>
                  ₹{(selectedPartner.paidEarnings || 0).toLocaleString("en-IN")}
                </strong>
              </span>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                icon={<FaEdit />}
                onClick={() => {
                  setDetailsModalOpen(false);
                  handleOpenEditPartner(selectedPartner);
                }}
              >
                Edit Partner
              </Button>
              <Button
                variant={
                  selectedPartner.status === "Active" ? "danger" : "success"
                }
                size="sm"
                icon={
                  selectedPartner.status === "Active" ? (
                    <FaBan />
                  ) : (
                    <FaCheck />
                  )
                }
                isLoading={togglingId === selectedPartner.id}
                onClick={() => handleTogglePartnerStatus(selectedPartner)}
              >
                {selectedPartner.status === "Active" ? "Disable" : "Enable"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE / EDIT PARTNER MODAL */}
      <Modal
        isOpen={addEditModalOpen}
        onClose={() => setAddEditModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            {editingPartner ? (
              <>
                <FaEdit className="text-blue-600" />
                <span>Edit Affiliate Partner</span>
              </>
            ) : (
              <>
                <FaPlus className="text-blue-600" />
                <span>Enroll New Affiliate Partner</span>
              </>
            )}
          </div>
        }
        size="md"
      >
        <form onSubmit={handleSubmitPartner} className="space-y-4">
          <Input
            label="Partner Name / Username"
            type="text"
            required
            placeholder="e.g. Rahul Sharma"
            value={partnerForm.user}
            error={partnerFormErrors.user}
            onChange={(e) =>
              setPartnerForm({ ...partnerForm, user: e.target.value })
            }
          />

          <Input
            label="Email Address"
            type="email"
            required
            placeholder="e.g. rahul@example.com"
            value={partnerForm.email}
            error={partnerFormErrors.email}
            onChange={(e) =>
              setPartnerForm({ ...partnerForm, email: e.target.value })
            }
          />

          <Input
            label="Unique Referral Code"
            type="text"
            required
            placeholder="e.g. RAHUL10"
            value={partnerForm.referralCode}
            error={partnerFormErrors.referralCode}
            helperText="Uppercase alphanumeric identifier for partner referral links"
            onChange={(e) =>
              setPartnerForm({
                ...partnerForm,
                referralCode: e.target.value.toUpperCase().replace(/\s+/g, ""),
              })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Commission Rate (%)"
              type="number"
              min="1"
              max="100"
              step="0.5"
              required
              value={partnerForm.commissionRate}
              error={partnerFormErrors.commissionRate}
              helperText="Partner percentage share"
              onChange={(e) =>
                setPartnerForm({
                  ...partnerForm,
                  commissionRate: e.target.value,
                })
              }
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Account Status
              </label>
              <select
                value={partnerForm.status}
                onChange={(e) =>
                  setPartnerForm({ ...partnerForm, status: e.target.value })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAddEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingPartner}
              icon={<FaCheckCircle />}
            >
              {editingPartner ? "Update Partner" : "Create Partner"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmVariant={confirmDialog.confirmVariant}
        confirmText={confirmDialog.confirmText}
        onConfirm={() => {
          confirmDialog.onConfirm();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        onClose={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </AdminLayout>
  );
}

export default AdminAffiliate;

