/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaTools,
  FaSave,
  FaClock,
  FaShieldAlt,
  FaExclamationTriangle,
  FaSync,
  FaUndo,
  FaCoins,
  FaCheckCircle,
  FaUserPlus,
  FaUserLock,
  FaEnvelope,
  FaInfoCircle,
  FaSun,
  FaMoon,
  FaDesktop,
  FaPalette,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

const DEFAULT_SETTINGS = {
  theme: "light",
  maintenanceMode: false,
  maintenanceMessage:
    "Gromage SMM Panel is temporarily undergoing scheduled maintenance and infrastructure upgrades. Service processing and order delivery will resume shortly. Thank you for your patience.",
  defaultCurrency: "INR",
  usdExchangeRate: 86.5,
  timezone: "Asia/Kolkata (IST)",
  defaultLanguage: "English",
  allowRegistration: true,
  emailVerification: false,
  twoFactorAuth: false,
  orderSyncCronMinutes: 5,
};

const THEME_OPTIONS = [
  {
    id: "light",
    name: "Light Mode",
    tag: "Default Theme",
    icon: FaSun,
    iconBg: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    description:
      "Clean, high-contrast light interface with bright white surfaces and slate borders. Optimized for standard desktop usage in daylight.",
    previewBg: "bg-slate-100 border-slate-200",
    previewCard: "bg-white border-gray-200 text-gray-800",
  },
  {
    id: "dark",
    name: "Dark Mode",
    tag: "Low Eye Strain",
    icon: FaMoon,
    iconBg: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    description:
      "Deep slate and charcoal dark theme designed to minimize eye fatigue in low-light environments and conserve OLED display energy.",
    previewBg: "bg-slate-950 border-slate-800",
    previewCard: "bg-slate-900 border-slate-700 text-slate-100",
  },
  {
    id: "system",
    name: "System Default",
    tag: "Auto Synchronized",
    icon: FaDesktop,
    iconBg: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    description:
      "Automatically synchronizes with your device operating system or browser light/dark mode preference via media queries.",
    previewBg: "bg-linear-to-r from-slate-100 to-slate-950 border-slate-400/40",
    previewCard: "bg-white/90 dark:bg-slate-900 border-slate-300 text-slate-900",
  },
];

const SUPPORTED_CURRENCIES = [
  { code: "INR", label: "INR (₹ Indian Rupee)", symbol: "₹" },
  { code: "USD", label: "USD ($ US Dollar)", symbol: "$" },
  { code: "EUR", label: "EUR (€ Euro)", symbol: "€" },
  { code: "GBP", label: "GBP (£ British Pound)", symbol: "£" },
];

const SUPPORTED_TIMEZONES = [
  { value: "Asia/Kolkata (IST)", label: "Asia/Kolkata (IST +5:30)" },
  { value: "UTC", label: "UTC (+0:00)" },
  { value: "America/New_York (EST)", label: "America/New_York (EST -5:00)" },
  { value: "Europe/London (GMT)", label: "Europe/London (GMT +0:00)" },
  { value: "Asia/Dubai (GST)", label: "Asia/Dubai (GST +4:00)" },
  { value: "Asia/Singapore (SGT)", label: "Asia/Singapore (SGT +8:00)" },
];

function AdminSystemSettings() {
  const { addToast } = useToast();

  // Settings State
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const [initialData, setInitialData] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Confirmation dialog states
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [confirmRefreshOpen, setConfirmRefreshOpen] = useState(false);

  // Load Settings from service
  const loadSettings = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);

      try {
        const data = await adminService.getSystemSettings();
        if (data) {
          const merged = { ...DEFAULT_SETTINGS, ...data };
          setFormData(merged);
          setInitialData(merged);
        }
        if (isManualRefresh) {
          addToast("System settings reloaded successfully", "success");
        }
      } catch (err) {
        const msg = err?.message || "Failed to load system settings";
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
    loadSettings();
  }, [loadSettings]);

  // Dirty State (Unsaved Changes) Tracking
  const isDirty = useMemo(() => {
    if (!formData || !initialData) return false;
    return (
      (formData.theme || "light") !== (initialData.theme || "light") ||
      Boolean(formData.maintenanceMode) !== Boolean(initialData.maintenanceMode) ||
      (formData.maintenanceMessage || "").trim() !==
        (initialData.maintenanceMessage || "").trim() ||
      formData.defaultCurrency !== initialData.defaultCurrency ||
      Number(formData.usdExchangeRate) !== Number(initialData.usdExchangeRate) ||
      formData.timezone !== initialData.timezone ||
      Boolean(formData.allowRegistration) !== Boolean(initialData.allowRegistration) ||
      Boolean(formData.emailVerification) !== Boolean(initialData.emailVerification) ||
      Boolean(formData.twoFactorAuth) !== Boolean(initialData.twoFactorAuth) ||
      Number(formData.orderSyncCronMinutes) !== Number(initialData.orderSyncCronMinutes)
    );
  }, [formData, initialData]);

  // Form Validation
  const validateForm = () => {
    const errors = {};

    // Maintenance message validation if maintenance mode is enabled
    if (formData.maintenanceMode) {
      const msg = (formData.maintenanceMessage || "").trim();
      if (!msg) {
        errors.maintenanceMessage =
          "A maintenance notice message is required when maintenance mode is enabled";
      } else if (msg.length > 500) {
        errors.maintenanceMessage = "Maintenance notice cannot exceed 500 characters";
      }
    }

    // USD Exchange Rate validation
    const rate = Number(formData.usdExchangeRate);
    if (isNaN(rate) || rate <= 0) {
      errors.usdExchangeRate = "USD exchange rate must be a valid number greater than 0";
    }

    // Cron interval validation
    const cron = Number(formData.orderSyncCronMinutes);
    if (isNaN(cron) || !Number.isInteger(cron) || cron < 1 || cron > 60) {
      errors.orderSyncCronMinutes =
        "Sync interval must be an integer between 1 and 60 minutes";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Theme selection handler with instant preview
  const handleThemeSelect = (themeId) => {
    setFormData((prev) => ({ ...prev, theme: themeId }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("admin_theme_change", { detail: { theme: themeId } })
      );
    }
  };

  // Save Settings
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      addToast("Please correct the errors in the form before saving", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        theme: formData.theme || "light",
        maintenanceMode: Boolean(formData.maintenanceMode),
        maintenanceMessage: (formData.maintenanceMessage || "").trim(),
        defaultCurrency: formData.defaultCurrency,
        usdExchangeRate: Number(formData.usdExchangeRate),
        timezone: formData.timezone,
        defaultLanguage: formData.defaultLanguage || "English",
        allowRegistration: Boolean(formData.allowRegistration),
        emailVerification: Boolean(formData.emailVerification),
        twoFactorAuth: Boolean(formData.twoFactorAuth),
        orderSyncCronMinutes: Number(formData.orderSyncCronMinutes),
      };

      const response = await adminService.updateSystemSettings(payload);
      if (response && response.success === false) {
        throw new Error(response.message || "Failed to update system settings");
      }

      setInitialData(payload);
      setFormData(payload);
      setFormErrors({});
      addToast("System & theme settings saved successfully", "success");
    } catch (err) {
      const msg = err?.message || "Failed to save system settings";
      addToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Discard Changes
  const handleDiscard = () => {
    setFormData(initialData);
    setFormErrors({});
    setConfirmDiscardOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("admin_theme_change", {
          detail: { theme: initialData.theme || "light" },
        })
      );
    }
    addToast("Unsaved changes discarded", "info");
  };

  // Refresh Action handler with dirty check
  const handleRefreshClick = () => {
    if (isDirty) {
      setConfirmRefreshOpen(true);
    } else {
      loadSettings(true);
    }
  };

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              System & Operational Settings
            </h1>
            {isDirty && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                ● Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure platform theme & appearance, maintenance mode, cron automations, currency conversion, and authentication controls
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshClick}
            isLoading={refreshing}
            disabled={loading || refreshing || isSaving}
            icon={
              <FaSync
                className={refreshing ? "animate-spin text-blue-600" : "text-gray-600"}
              />
            }
          >
            Refresh Settings
          </Button>

          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDiscardOpen(true)}
              disabled={isSaving}
              icon={<FaUndo className="text-rose-500" />}
            >
              Discard
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={loading || isSaving || !isDirty}
            icon={<FaSave />}
          >
            Save Settings
          </Button>
        </div>
      </div>

      {/* Error / Retry Banner */}
      {fetchError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl mb-6 flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <FaExclamationTriangle className="text-rose-600 dark:text-rose-400 text-base shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button size="xs" variant="outline" onClick={() => loadSettings(false)}>
            Retry Loading
          </Button>
        </div>
      )}

      {/* SECTION 1: Dynamic System Settings Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Active UI Theme Mode */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5 transition-colors">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              formData.theme === "dark"
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                : formData.theme === "system"
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            }`}
          >
            {formData.theme === "dark" ? (
              <FaMoon />
            ) : formData.theme === "system" ? (
              <FaDesktop />
            ) : (
              <FaSun />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              UI Theme
            </p>
            {loading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <div className="mt-0.5">
                <div className="font-bold text-sm text-gray-900 dark:text-slate-100 capitalize truncate">
                  {formData.theme === "system"
                    ? "System Auto"
                    : `${formData.theme || "Light"} Mode`}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                  {formData.theme === "system"
                    ? "Syncs with OS preference"
                    : "Browser persisted"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Platform Maintenance Status */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5 transition-colors">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              formData.maintenanceMode
                ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
            }`}
          >
            <FaTools />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Platform Status
            </p>
            {loading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <div className="mt-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-bold text-sm ${
                      formData.maintenanceMode
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {formData.maintenanceMode ? "Maintenance Active" : "Live & Operational"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                  {formData.maintenanceMode
                    ? "Customer access blocked"
                    : "All customer routes online"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User Registration Status */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5 transition-colors">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              formData.allowRegistration
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900"
                : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
            }`}
          >
            <FaUserPlus />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Public Signups
            </p>
            {loading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <div className="mt-0.5">
                <div className="font-bold text-sm text-gray-900 dark:text-slate-100 truncate">
                  {formData.allowRegistration ? "Signups Allowed" : "Registration Closed"}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                  {formData.allowRegistration
                    ? "Visitors can register"
                    : "Invite only / Closed"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Security & 2FA Enforcement */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5 transition-colors">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              formData.twoFactorAuth
                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900"
                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400"
            }`}
          >
            <FaShieldAlt />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Admin 2FA & Auth
            </p>
            {loading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <div className="mt-0.5">
                <div className="font-bold text-sm text-gray-900 dark:text-slate-100 truncate">
                  {formData.twoFactorAuth ? "Mandatory 2FA" : "Standard Security"}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                  {formData.emailVerification
                    ? "Email OTP Enforced"
                    : "Email OTP Optional"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Currency & Cron Polling */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3.5 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-xl shrink-0">
            <FaCoins />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Currency & Cron
            </p>
            {loading ? (
              <Skeleton className="h-6 w-24 mt-1" />
            ) : (
              <div className="mt-0.5">
                <div className="font-bold text-sm text-gray-900 dark:text-slate-100 truncate">
                  {formData.defaultCurrency} (₹{formData.usdExchangeRate})
                </div>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                  Sync: Every {formData.orderSyncCronMinutes}m
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 2: Theme & Appearance Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 sm:p-6 shadow-xs transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FaPalette />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Theme & Visual Appearance
                </h2>
                <Badge status="Active" size="xs">
                  SRS Feature
                </Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Select your preferred interface color mode for the Admin CMS. Persisted in local browser storage.
              </p>
            </div>
          </div>

          {/* Theme Selector 3-Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = (formData.theme || "light") === theme.id;
              const IconComp = theme.icon;
              return (
                <div
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                    isSelected
                      ? "border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-600/40 dark:ring-blue-500/40 shadow-sm"
                      : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50/50 dark:hover:bg-slate-700/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${theme.iconBg}`}>
                        <IconComp />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600"
                          }`}
                        >
                          {theme.tag}
                        </span>
                        {isSelected && (
                          <FaCheckCircle className="text-blue-600 dark:text-blue-400 text-sm ml-1" />
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1">
                      {theme.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                      {theme.description}
                    </p>
                  </div>

                  {/* Visual Preview Box */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60">
                    <div className={`p-2.5 rounded-lg border text-[11px] ${theme.previewBg}`}>
                      <div className={`px-2.5 py-1.5 rounded border shadow-xs flex items-center justify-between ${theme.previewCard}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-semibold text-[10px] truncate">Admin Preview</span>
                        </div>
                        <span className="text-[9px] opacity-75 font-mono">
                          {theme.id === "dark" ? "Dark Theme" : theme.id === "system" ? "Auto Sync" : "Light Theme"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Theme Information Note */}
          <div className="mt-4 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2.5">
            <FaInfoCircle className="text-indigo-600 dark:text-indigo-400 shrink-0 text-sm" />
            <div className="flex-1">
              <strong>Instant Live Preview:</strong> Switching themes applies an immediate preview across the Admin Panel interface. Click <strong>"Save Settings"</strong> to permanently store your theme choice in your browser.
            </div>
          </div>
        </div>

        {/* SECTION 3: Maintenance Mode Configuration */}
        <div
          className={`rounded-xl border p-5 sm:p-6 transition-all shadow-xs ${
            formData.maintenanceMode
              ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 ring-1 ring-rose-400/80 dark:ring-rose-700/80"
              : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  formData.maintenanceMode
                    ? "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                }`}
              >
                <FaTools />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    Platform Maintenance Mode
                  </h2>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      formData.maintenanceMode
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    }`}
                  >
                    {formData.maintenanceMode
                      ? "MAINTENANCE ACTIVE"
                      : "LIVE & OPERATIONAL"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  When enabled, all customer portal pages will display the maintenance notice and temporarily suspend ordering and payments
                </p>
              </div>
            </div>

            {/* Maintenance Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-center">
              <input
                type="checkbox"
                checked={formData.maintenanceMode}
                onChange={(e) => {
                  setFormData({ ...formData, maintenanceMode: e.target.checked });
                  if (formErrors.maintenanceMessage) {
                    setFormErrors({ ...formErrors, maintenanceMessage: null });
                  }
                }}
                className="sr-only peer"
                aria-label="Toggle Platform Maintenance Mode"
              />
              <div className="w-12 h-6.5 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-rose-600" />
            </label>
          </div>

          {/* Maintenance Notice Message Input */}
          {formData.maintenanceMode && (
            <div className="mt-5 pt-5 border-t border-rose-200/80 dark:border-rose-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-200">
                  Customer Maintenance Notice Message <span className="text-rose-600 dark:text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-mono">
                  {(formData.maintenanceMessage || "").length} / 500 characters
                </span>
              </div>

              <textarea
                rows={3}
                maxLength={500}
                value={formData.maintenanceMessage}
                onChange={(e) => {
                  setFormData({ ...formData, maintenanceMessage: e.target.value });
                  if (formErrors.maintenanceMessage) {
                    setFormErrors({ ...formErrors, maintenanceMessage: null });
                  }
                }}
                placeholder="Enter the notice message shown to customers during maintenance..."
                className={`w-full bg-white dark:bg-slate-900 rounded-lg border p-3 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-colors ${
                  formErrors.maintenanceMessage
                    ? "border-rose-500 ring-1 ring-rose-500"
                    : "border-rose-300 dark:border-rose-700"
                }`}
              />

              {formErrors.maintenanceMessage && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {formErrors.maintenanceMessage}
                </p>
              )}

              {/* Maintenance Notice Simulation Preview */}
              <div className="p-3 bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800 rounded-lg text-xs">
                <div className="font-semibold text-rose-800 dark:text-rose-300 mb-1 flex items-center gap-1.5">
                  <FaExclamationTriangle className="text-rose-600 dark:text-rose-400" />
                  <span>Customer Notice Simulation Preview:</span>
                </div>
                <p className="text-gray-700 dark:text-slate-300 italic leading-relaxed">
                  "{formData.maintenanceMessage || "Platform is currently undergoing scheduled maintenance."}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: Localization, Currency & Exchange Rates */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 sm:p-6 shadow-xs transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FaCoins />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Localization & Currency Configuration
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Configure primary billing currency, USD conversion rate, and server timezone
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Default Currency */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Default Platform Currency
              </label>
              <select
                value={formData.defaultCurrency}
                onChange={(e) =>
                  setFormData({ ...formData, defaultCurrency: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                Primary currency used for user balances and service catalog rates.
              </p>
            </div>

            {/* USD to INR Exchange Rate */}
            <div>
              <Input
                label="USD Exchange Rate (1 USD = ? INR)"
                type="number"
                step="0.01"
                min="0.1"
                placeholder="86.50"
                value={formData.usdExchangeRate}
                error={formErrors.usdExchangeRate}
                helperText="Used to convert wholesale provider costs in USD to INR"
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    usdExchangeRate: e.target.value,
                  });
                  if (formErrors.usdExchangeRate) {
                    setFormErrors({ ...formErrors, usdExchangeRate: null });
                  }
                }}
              />
            </div>

            {/* Server Timezone */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Server Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) =>
                  setFormData({ ...formData, timezone: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-xs sm:text-sm bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors cursor-pointer"
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                Used for transaction timestamps, reports, and cron schedules.
              </p>
            </div>
          </div>

          {/* Live Currency Conversion Simulator */}
          <div className="mt-4 p-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-xl text-xs text-blue-950 dark:text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FaInfoCircle className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                <strong>Exchange Rate Simulator:</strong> $1.00 USD = ₹
                {(Number(formData.usdExchangeRate) || 0).toFixed(2)} INR
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-blue-800 dark:text-blue-300">
              <span>$10.00 USD = ₹{((Number(formData.usdExchangeRate) || 0) * 10).toFixed(2)}</span>
              <span>•</span>
              <span>$100.00 USD = ₹{((Number(formData.usdExchangeRate) || 0) * 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* SECTION 5: Security, Registration & Auth Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 sm:p-6 shadow-xs transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FaShieldAlt />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Security & Registration Controls
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Configure user signup availability, email verification enforcement, and administrator 2FA
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Allow Public User Signups */}
            <label
              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all select-none ${
                formData.allowRegistration
                  ? "bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-300/60 dark:ring-emerald-700/60"
                  : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700 hover:bg-gray-100/70 dark:hover:bg-slate-700/40"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 mt-0.5 ${
                    formData.allowRegistration
                      ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                  }`}
                >
                  <FaUserPlus />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      Allow Public User Signups
                    </span>
                    <Badge
                      status={formData.allowRegistration ? "Active" : "Disabled"}
                      size="xs"
                    >
                      {formData.allowRegistration ? "Public Signups Open" : "Closed / Invite Only"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Permit new visitors to register accounts on the customer panel. If disabled, only existing users can log in.
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={formData.allowRegistration}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    allowRegistration: e.target.checked,
                  })
                }
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-5 w-5 cursor-pointer ml-4"
              />
            </label>

            {/* Require Email OTP / Verification */}
            <label
              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all select-none ${
                formData.emailVerification
                  ? "bg-blue-50/40 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 ring-1 ring-blue-300/60 dark:ring-blue-700/60"
                  : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700 hover:bg-gray-100/70 dark:hover:bg-slate-700/40"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 mt-0.5 ${
                    formData.emailVerification
                      ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-400"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                  }`}
                >
                  <FaEnvelope />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      Require Email OTP / Account Verification
                    </span>
                    <Badge
                      status={formData.emailVerification ? "Active" : "Disabled"}
                      size="xs"
                    >
                      {formData.emailVerification ? "Enforced" : "Optional / Disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Force customers to verify their email address via 6-digit OTP before placing orders or recharging wallets.
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={formData.emailVerification}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    emailVerification: e.target.checked,
                  })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5 cursor-pointer ml-4"
              />
            </label>

            {/* Mandatory Two-Factor Authentication for Admins */}
            <label
              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all select-none ${
                formData.twoFactorAuth
                  ? "bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-300/60 dark:ring-indigo-700/60"
                  : "bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700 hover:bg-gray-100/70 dark:hover:bg-slate-700/40"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 mt-0.5 ${
                    formData.twoFactorAuth
                      ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                  }`}
                >
                  <FaUserLock />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      Mandatory Two-Factor Authentication (2FA) for Admins
                    </span>
                    <Badge
                      status={formData.twoFactorAuth ? "Active" : "Disabled"}
                      size="xs"
                    >
                      {formData.twoFactorAuth ? "2FA Mandatory" : "2FA Optional"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Require TOTP authenticator app code for all administrator and staff accounts during authentication.
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={formData.twoFactorAuth}
                onChange={(e) =>
                  setFormData({ ...formData, twoFactorAuth: e.target.checked })
                }
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-5 w-5 cursor-pointer ml-4"
              />
            </label>
          </div>

          {/* Security Notice Box */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-600 dark:text-slate-400 flex items-center gap-2.5">
            <FaShieldAlt className="text-gray-400 dark:text-slate-500 shrink-0 text-sm" />
            <span>
              <strong>Security Architecture Note:</strong> These authentication controls are stored as global system configurations and will be enforced by backend security middleware upon official API integration.
            </span>
          </div>
        </div>

        {/* SECTION 6: Background Sync Frequencies & Cron Automations */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 sm:p-6 shadow-xs transition-colors">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FaClock />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Background Sync Frequencies & Automation
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Configure background polling intervals for upstream provider order status synchronization
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <Input
              label="Order Status Sync Interval (Minutes)"
              type="number"
              min="1"
              max="60"
              step="1"
              value={formData.orderSyncCronMinutes}
              error={formErrors.orderSyncCronMinutes}
              helperText="How often provider status is automatically polled (1 - 60 minutes)"
              onChange={(e) => {
                setFormData({
                  ...formData,
                  orderSyncCronMinutes: e.target.value,
                });
                if (formErrors.orderSyncCronMinutes) {
                  setFormErrors({ ...formErrors, orderSyncCronMinutes: null });
                }
              }}
            />
          </div>

          {/* Cron Interval Calculation Summary */}
          <div className="mt-4 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2.5">
            <FaClock className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="flex-1">
              <strong>Automation Schedule Preview:</strong> Provider order synchronization worker will execute{" "}
              <strong>every {formData.orderSyncCronMinutes || 5} minute(s)</strong> (~
              {Math.max(1, Math.round(60 / (Number(formData.orderSyncCronMinutes) || 5)))}{" "}
              sync cycles per hour).
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="sticky bottom-4 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-gray-200 dark:border-slate-700 p-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
          <div className="text-xs flex items-center gap-2">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                <FaExclamationTriangle className="text-amber-500" />
                You have unsaved changes in system settings
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                <FaCheckCircle className="text-emerald-500" />
                All system settings are up to date
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {isDirty && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDiscardOpen(true)}
                disabled={isSaving}
              >
                Discard Changes
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              disabled={isSaving || !isDirty}
              icon={<FaSave />}
            >
              Save System Settings
            </Button>
          </div>
        </div>
      </form>

      {/* Confirm Discard Dialog */}
      <ConfirmDialog
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={handleDiscard}
        title="Discard Unsaved Changes?"
        message="You have unsaved modifications in system settings. Are you sure you want to discard your changes and revert to the last saved configuration?"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        variant="danger"
      />

      {/* Confirm Refresh Dialog */}
      <ConfirmDialog
        isOpen={confirmRefreshOpen}
        onClose={() => setConfirmRefreshOpen(false)}
        onConfirm={() => {
          setConfirmRefreshOpen(false);
          loadSettings(true);
        }}
        title="Reload Settings from Server?"
        message="You have unsaved changes that will be lost if you reload settings from the service layer. Do you want to proceed?"
        confirmText="Reload & Discard"
        cancelText="Cancel"
        variant="danger"
      />
    </AdminLayout>
  );
}

export default AdminSystemSettings;

