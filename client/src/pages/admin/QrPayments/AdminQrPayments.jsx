/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaQrcode,
  FaSave,
  FaMobileAlt,
  FaSync,
  FaCheckCircle,
  FaBan,
  FaExclamationTriangle,
  FaInfoCircle,
  FaGift,
  FaRupeeSign,
  FaStore,
  FaLink,
  FaCopy,
  FaCheck,
  FaUndo,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

function AdminQrPayments() {
  const { addToast } = useToast();

  // Primary Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    isEnabled: true,
    upiId: "",
    merchantName: "",
    qrImageUrl: "",
    minRecharge: 100,
    maxRecharge: 50000,
    bonusPercentage: 5,
    instructions: "",
  });

  const [initialData, setInitialData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [imageLoadError, setImageLoadError] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // -------------------------------------------------------------
  // Fetch Settings
  // -------------------------------------------------------------
  const fetchSettings = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setFetchError(null);

      try {
        const data = await adminService.getQrSettings();
        const normalized = {
          isEnabled:
            data.isEnabled !== undefined
              ? Boolean(data.isEnabled)
              : data.enabled !== undefined
              ? Boolean(data.enabled)
              : true,
          upiId: data.upiId || "",
          merchantName: data.merchantName || data.displayName || "",
          qrImageUrl: data.qrImageUrl || data.qrImage || "",
          minRecharge: data.minRecharge !== undefined ? Number(data.minRecharge) : 100,
          maxRecharge: data.maxRecharge !== undefined ? Number(data.maxRecharge) : 50000,
          bonusPercentage:
            data.bonusPercentage !== undefined ? Number(data.bonusPercentage) : 5,
          instructions: data.instructions || "",
        };

        setFormData(normalized);
        setInitialData(normalized);
        setFormErrors({});
        setImageLoadError(false);

        if (isManualRefresh) {
          addToast("QR Payment settings refreshed", "success");
        }
      } catch (err) {
        console.error("Failed to load QR CMS settings:", err);
        setFetchError("Failed to load QR CMS settings. Please try again.");
        addToast("Failed to load QR CMS settings", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Reset image error when URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [formData.qrImageUrl]);

  // -------------------------------------------------------------
  // Unsaved Changes (Dirty) Detection
  // -------------------------------------------------------------
  const isDirty = useMemo(() => {
    if (!initialData) return false;
    return (
      formData.isEnabled !== initialData.isEnabled ||
      formData.upiId !== initialData.upiId ||
      formData.merchantName !== initialData.merchantName ||
      formData.qrImageUrl !== initialData.qrImageUrl ||
      Number(formData.minRecharge) !== Number(initialData.minRecharge) ||
      Number(formData.maxRecharge) !== Number(initialData.maxRecharge) ||
      Number(formData.bonusPercentage) !== Number(initialData.bonusPercentage) ||
      formData.instructions !== initialData.instructions
    );
  }, [formData, initialData]);

  const handleResetForm = () => {
    if (initialData) {
      setFormData(initialData);
      setFormErrors({});
      setImageLoadError(false);
      addToast("Changes reverted to saved state", "info");
    }
  };

  // -------------------------------------------------------------
  // Clipboard Helper for Live Preview
  // -------------------------------------------------------------
  const handleCopyUpi = () => {
    if (!formData.upiId) return;
    navigator.clipboard.writeText(formData.upiId);
    setCopiedUpi(true);
    addToast(`UPI ID "${formData.upiId}" copied to clipboard`, "info");
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // -------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------
  const validateForm = () => {
    const errors = {};

    // UPI ID validation
    const trimmedUpi = formData.upiId.trim();
    if (!trimmedUpi) {
      errors.upiId = "UPI ID / VPA is required";
    } else if (!trimmedUpi.includes("@") || trimmedUpi.length < 4) {
      errors.upiId = "Please enter a valid UPI VPA (e.g. business@bank)";
    }

    // Merchant Name validation
    const trimmedName = formData.merchantName.trim();
    if (!trimmedName) {
      errors.merchantName = "Merchant / Business Name is required";
    } else if (trimmedName.length < 2) {
      errors.merchantName = "Business name must be at least 2 characters long";
    }

    // QR Image URL validation
    const trimmedQr = formData.qrImageUrl.trim();
    if (formData.isEnabled && !trimmedQr) {
      errors.qrImageUrl = "QR Code Image URL is required when QR payment is enabled";
    } else if (
      trimmedQr &&
      !trimmedQr.startsWith("http://") &&
      !trimmedQr.startsWith("https://") &&
      !trimmedQr.startsWith("/") &&
      !trimmedQr.startsWith("data:image/")
    ) {
      errors.qrImageUrl = "Please provide a valid image URL (http://, https://, or relative path)";
    }

    // Min Recharge validation
    const minVal = Number(formData.minRecharge);
    if (formData.minRecharge === "" || isNaN(minVal) || minVal < 1) {
      errors.minRecharge = "Minimum recharge must be greater than ₹0";
    }

    // Max Recharge validation
    const maxVal = Number(formData.maxRecharge);
    if (formData.maxRecharge === "" || isNaN(maxVal) || maxVal <= 0) {
      errors.maxRecharge = "Maximum recharge must be greater than ₹0";
    } else if (minVal > 0 && maxVal < minVal) {
      errors.maxRecharge = "Maximum recharge must be greater than or equal to minimum recharge";
    }

    // Bonus Percentage validation
    const bonusVal = Number(formData.bonusPercentage);
    if (
      formData.bonusPercentage === "" ||
      isNaN(bonusVal) ||
      bonusVal < 0 ||
      bonusVal > 100
    ) {
      errors.bonusPercentage = "Bonus percentage must be between 0% and 100%";
    }

    // Instructions length validation
    if (formData.instructions && formData.instructions.length > 1000) {
      errors.instructions = "Instructions must not exceed 1000 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // -------------------------------------------------------------
  // Save Settings
  // -------------------------------------------------------------
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      addToast("Please correct the errors in the form before saving", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        isEnabled: Boolean(formData.isEnabled),
        enabled: Boolean(formData.isEnabled),
        upiId: formData.upiId.trim(),
        merchantName: formData.merchantName.trim(),
        displayName: formData.merchantName.trim(),
        qrImageUrl: formData.qrImageUrl.trim(),
        qrImage: formData.qrImageUrl.trim(),
        minRecharge: Number(formData.minRecharge),
        maxRecharge: Number(formData.maxRecharge),
        bonusPercentage: Number(formData.bonusPercentage),
        instructions: formData.instructions.trim(),
      };

      const res = await adminService.updateQrSettings(payload);
      const savedData = {
        isEnabled: Boolean(res.isEnabled ?? res.enabled ?? payload.isEnabled),
        upiId: res.upiId || payload.upiId,
        merchantName: res.merchantName || res.displayName || payload.merchantName,
        qrImageUrl: res.qrImageUrl || res.qrImage || payload.qrImageUrl,
        minRecharge: Number(res.minRecharge ?? payload.minRecharge),
        maxRecharge: Number(res.maxRecharge ?? payload.maxRecharge),
        bonusPercentage: Number(res.bonusPercentage ?? payload.bonusPercentage),
        instructions: res.instructions ?? payload.instructions,
      };

      setFormData(savedData);
      setInitialData(savedData);
      setFormErrors({});
      addToast("QR Payment CMS settings saved successfully", "success");
    } catch {
      addToast("Failed to save QR payment settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              QR Payment CMS
            </h1>
            {!loading && (
              <Badge
                status={formData.isEnabled ? "Active" : "Disabled"}
                size="sm"
              >
                {formData.isEnabled ? "Active / Live" : "Disabled / Paused"}
              </Badge>
            )}
            {isDirty && (
              <span className="hidden sm:inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                ● Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Configure dynamic UPI QR codes, merchant billing details, deposit instructions, and live recharge limits
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              size="sm"
              variant="ghost"
              icon={<FaUndo />}
              onClick={handleResetForm}
              disabled={isSaving}
              title="Discard unsaved changes"
            >
              Discard
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            icon={<FaSync />}
            isLoading={refreshing}
            onClick={() => fetchSettings(true)}
            disabled={isSaving}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<FaSave />}
            onClick={handleSave}
            isLoading={isSaving}
          >
            Save CMS Settings
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{fetchError}</span>
          </div>
          <Button
            size="xs"
            variant="danger"
            onClick={() => fetchSettings(true)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Payment Method Status */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Gateway Status
            </p>
            <div
              className={`p-2 rounded-lg text-xs ${
                formData.isEnabled
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {formData.isEnabled ? <FaCheckCircle /> : <FaBan />}
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : formData.isEnabled ? (
              <span className="text-emerald-600">Enabled</span>
            ) : (
              <span className="text-rose-600">Disabled</span>
            )}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">
            {formData.isEnabled
              ? "Visible on customer checkout"
              : "Recharges temporarily paused"}
          </p>
        </div>

        {/* Card 2: UPI Merchant ID */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              UPI Merchant VPA
            </p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg text-xs">
              <FaMobileAlt />
            </div>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mt-2 font-mono truncate">
            {loading ? (
              <Skeleton className="h-6 w-32" />
            ) : formData.upiId ? (
              formData.upiId
            ) : (
              <span className="text-amber-500 text-sm">Not Configured</span>
            )}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1 truncate">
            {formData.merchantName || "Default Merchant"}
          </p>
        </div>

        {/* Card 3: Recharge Range */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Recharge Range
            </p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs">
              <FaRupeeSign />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-indigo-600 mt-2 font-mono">
            {loading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              `₹${formData.minRecharge || 0} – ₹${Number(
                formData.maxRecharge || 0
              ).toLocaleString("en-IN")}`
            )}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">Minimum to maximum limits</p>
        </div>

        {/* Card 4: Recharge Bonus */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Deposit Incentive
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs">
              <FaGift />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-2">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : Number(formData.bonusPercentage) > 0 ? (
              `+${formData.bonusPercentage}% Extra`
            ) : (
              <span className="text-gray-400 text-base font-semibold">
                No Bonus Active
              </span>
            )}
          </h3>
          <p className="text-[11px] text-gray-400 mt-1">
            Credited automatically to wallet
          </p>
        </div>
      </div>

      {/* Main Grid: Settings Form & Live Customer Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form Column */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <Skeleton className="h-8 w-1/3" />
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Section 1: Gateway Status */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <FaCheckCircle className="text-blue-600" />
                      Payment Gateway Status
                    </h3>
                    <p className="text-xs text-gray-500">
                      Enable or pause QR & UPI recharges across all customer checkout sessions
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formData.isEnabled}
                      onChange={(e) =>
                        setFormData({ ...formData, isEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
              </div>

              {/* Section 2: Merchant Identifiers */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                  <FaStore className="text-blue-600" />
                  UPI Merchant Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="UPI ID / VPA"
                    required
                    placeholder="e.g. gromage@icici"
                    icon={<FaMobileAlt />}
                    value={formData.upiId}
                    error={formErrors.upiId}
                    helperText="Valid Virtual Payment Address linked to your business account"
                    onChange={(e) =>
                      setFormData({ ...formData, upiId: e.target.value })
                    }
                  />

                  <Input
                    label="Merchant / Business Name"
                    required
                    placeholder="e.g. Gromage SMM Panel"
                    icon={<FaStore />}
                    value={formData.merchantName}
                    error={formErrors.merchantName}
                    helperText="Shown to customer on verification screen & QR banner"
                    onChange={(e) =>
                      setFormData({ ...formData, merchantName: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Section 3: QR Code Configuration */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                  <FaQrcode className="text-blue-600" />
                  QR Code Image Configuration
                </h3>

                <div className="space-y-3">
                  <Input
                    label="QR Code Image URL"
                    required={formData.isEnabled}
                    placeholder="https://.../qr.png or hosted QR link"
                    icon={<FaLink />}
                    value={formData.qrImageUrl}
                    error={formErrors.qrImageUrl}
                    helperText="Paste direct public image URL, cloud storage link, or QR image path"
                    onChange={(e) =>
                      setFormData({ ...formData, qrImageUrl: e.target.value })
                    }
                  />

                  {/* Thumbnail / Status Row */}
                  {formData.qrImageUrl && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-12 h-12 bg-white rounded border border-gray-300 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                        {!imageLoadError ? (
                          <img
                            src={formData.qrImageUrl}
                            alt="QR Thumbnail"
                            className="w-full h-full object-contain"
                            onError={() => setImageLoadError(true)}
                          />
                        ) : (
                          <FaExclamationTriangle className="text-amber-500 text-sm" />
                        )}
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-gray-800 block">
                          {!imageLoadError ? "QR Image Linked" : "Image Load Error"}
                        </span>
                        <span className="text-gray-500 text-[11px] block truncate max-w-sm">
                          {!imageLoadError
                            ? "Image preview loaded successfully in preview card"
                            : "Could not load image from provided URL. Check link permissions."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Recharge Limits & Bonus */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 pb-2 border-b border-gray-100">
                  <FaRupeeSign className="text-blue-600" />
                  Recharge Limits & User Bonus
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Min Recharge (₹)"
                    type="number"
                    min="1"
                    required
                    value={formData.minRecharge}
                    error={formErrors.minRecharge}
                    helperText="Minimum deposit allowed"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minRecharge: e.target.value,
                      })
                    }
                  />

                  <Input
                    label="Max Recharge (₹)"
                    type="number"
                    min="1"
                    required
                    value={formData.maxRecharge}
                    error={formErrors.maxRecharge}
                    helperText="Maximum single transaction"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxRecharge: e.target.value,
                      })
                    }
                  />

                  <Input
                    label="Recharge Bonus (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.bonusPercentage}
                    error={formErrors.bonusPercentage}
                    helperText="Extra bonus added to wallet"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bonusPercentage: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Section 5: Payment Instructions */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FaInfoCircle className="text-blue-600" />
                    Customer Payment Instructions
                  </h3>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {formData.instructions?.length || 0} / 1000 chars
                  </span>
                </div>

                <div>
                  <textarea
                    rows={5}
                    value={formData.instructions}
                    maxLength={1000}
                    onChange={(e) =>
                      setFormData({ ...formData, instructions: e.target.value })
                    }
                    placeholder="Enter step-by-step payment instructions shown below the QR code..."
                    className={`w-full rounded-lg border p-3 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors bg-white ${
                      formErrors.instructions
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500"
                        : "border-gray-300"
                    }`}
                  />
                  {formErrors.instructions ? (
                    <p className="mt-1 text-xs text-rose-500">
                      {formErrors.instructions}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Supports multi-line steps. Shown directly to customers below the QR code.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {isDirty ? (
                      <span className="text-amber-600 font-medium">
                        ● You have unsaved changes
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">
                        ✓ All changes saved
                      </span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={<FaSave />}
                    isLoading={isSaving}
                  >
                    Save CMS Settings
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Live Customer Preview Column */}
        <div>
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 sticky top-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FaMobileAlt className="text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Live User Panel Preview
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Customer View
              </span>
            </div>

            {/* Paused Warning if Disabled */}
            {!formData.isEnabled && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <FaExclamationTriangle className="text-amber-400 shrink-0" />
                <span>
                  QR payment is currently <strong>disabled</strong>. Customers will see this method as unavailable.
                </span>
              </div>
            )}

            {/* Customer Checkout Card */}
            <div className="bg-white text-gray-900 rounded-xl p-4 sm:p-5 shadow-inner space-y-4">
              {/* Header inside preview */}
              <div className="text-center pb-2 border-b border-gray-100">
                <span className="text-[10px] uppercase font-extrabold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full tracking-wider">
                  ⚡ Instant UPI Recharge
                </span>
                <h4 className="text-base font-black text-gray-900 mt-2">
                  {formData.merchantName || "Gromage SMM Panel"}
                </h4>

                {/* Copyable UPI ID pill */}
                <div className="inline-flex items-center gap-1.5 mt-1.5 bg-gray-100 hover:bg-gray-200 transition-colors px-2.5 py-1 rounded-md border border-gray-200 cursor-pointer">
                  <span className="text-xs font-mono font-bold text-gray-800">
                    {formData.upiId || "merchant@upi"}
                  </span>
                  <button
                    type="button"
                    title="Copy UPI ID"
                    onClick={handleCopyUpi}
                    className="text-gray-400 hover:text-blue-600"
                  >
                    {copiedUpi ? (
                      <FaCheck className="text-emerald-600 text-xs" />
                    ) : (
                      <FaCopy className="text-xs" />
                    )}
                  </button>
                </div>
              </div>

              {/* QR Image Frame with Error Fallback */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
                {formData.qrImageUrl && !imageLoadError ? (
                  <img
                    src={formData.qrImageUrl}
                    alt="UPI QR Code"
                    className="w-48 h-48 object-contain rounded-lg shadow-xs bg-white p-1"
                    onError={() => setImageLoadError(true)}
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-100 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                    <FaQrcode className="text-4xl text-gray-300 mb-2" />
                    <span className="text-xs font-semibold text-gray-500">
                      {formData.qrImageUrl
                        ? "QR Preview Unavailable"
                        : "No QR Code Configured"}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-1">
                      {formData.qrImageUrl
                        ? "Check image URL access"
                        : "Enter QR image URL in settings"}
                    </span>
                  </div>
                )}
                <span className="text-[10px] text-gray-400 mt-2">
                  Scan using GPay, PhonePe, Paytm or BHIM
                </span>
              </div>

              {/* Bonus Banner */}
              {Number(formData.bonusPercentage) > 0 && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg text-center flex items-center justify-center gap-1.5">
                  <FaGift className="text-emerald-600" />
                  <span>
                    +{formData.bonusPercentage}% Extra Bonus credited automatically!
                  </span>
                </div>
              )}

              {/* Limits Tag */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 font-medium">
                <span>
                  Min: <strong>₹{formData.minRecharge || 0}</strong>
                </span>
                <span>
                  Max:{" "}
                  <strong>
                    ₹{Number(formData.maxRecharge || 0).toLocaleString("en-IN")}
                  </strong>
                </span>
              </div>

              {/* Instructions Preview */}
              <div className="space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="text-[10px] font-bold uppercase text-gray-500 block tracking-wider">
                  Payment Steps:
                </span>
                <div className="text-xs text-gray-600 whitespace-pre-line leading-relaxed font-sans">
                  {formData.instructions ||
                    "1. Scan the QR code with any UPI app.\n2. Enter the amount and complete payment.\n3. Enter the 12-digit UTR reference number."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminQrPayments;

