/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaSlidersH,
  FaSave,
  FaPaintBrush,
  FaCode,
  FaPhoneAlt,
  FaGlobe,
  FaEnvelope,
  FaWhatsapp,
  FaTelegram,
  FaSync,
  FaCheckCircle,
  FaExclamationTriangle,
  FaImage,
  FaPalette,
  FaUndo,
  FaInfoCircle,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

const DEFAULT_SETTINGS = {
  siteName: "Gromage SMM Panel",
  siteTitle: "Gromage SMM Panel - Automated Social Media Services",
  siteTagline: "India's #1 High-Speed Social Media Marketing Provider",
  logoUrl: "",
  faviconUrl: "",
  contactEmail: "support@gromage.com",
  contactPhone: "+91 98765 43210",
  whatsappNumber: "+91 98765 43210",
  telegramChannel: "https://t.me/gromage_support",
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  headerScripts: "",
  footerScripts: "",
  maintenanceMode: false,
};

// Helper: validate hex color code
function isValidHex(hex) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

// Helper: validate email address
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Helper: validate URL or relative asset path
function isValidUrlOrPath(str) {
  if (!str) return true;
  if (str.startsWith("/") || str.startsWith("./") || str.startsWith("../")) return true;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function AdminWebsiteSettings() {
  const { addToast } = useToast();

  // Settings states
  const [formData, setFormData] = useState(DEFAULT_SETTINGS);
  const [savedData, setSavedData] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Image preview error states
  const [logoError, setLogoError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  // Load website settings
  const loadSettings = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await adminService.getWebsiteSettings();
        if (data) {
          const merged = { ...DEFAULT_SETTINGS, ...data };
          setFormData(merged);
          setSavedData(merged);
          setLogoError(false);
          setFaviconError(false);
          setFormErrors({});
          if (isManual) {
            addToast("Website settings refreshed successfully", "success");
          }
        }
      } catch (err) {
        const msg = err?.message || "Failed to load website settings";
        setError(msg);
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

  // Track unsaved changes
  const isDirty = useMemo(() => {
    return (
      formData.siteName !== savedData.siteName ||
      formData.siteTagline !== savedData.siteTagline ||
      formData.logoUrl !== savedData.logoUrl ||
      formData.faviconUrl !== savedData.faviconUrl ||
      formData.contactEmail !== savedData.contactEmail ||
      formData.contactPhone !== savedData.contactPhone ||
      formData.whatsappNumber !== savedData.whatsappNumber ||
      formData.telegramChannel !== savedData.telegramChannel ||
      formData.primaryColor !== savedData.primaryColor ||
      formData.secondaryColor !== savedData.secondaryColor ||
      formData.headerScripts !== savedData.headerScripts ||
      formData.footerScripts !== savedData.footerScripts
    );
  }, [formData, savedData]);

  // Form field change handler
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (field === "logoUrl") setLogoError(false);
    if (field === "faviconUrl") setFaviconError(false);
  };

  // Color hex text input change handler
  const handleColorTextChange = (field, text) => {
    const trimmed = text.trim();
    const formatted = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    setFormData((prev) => ({ ...prev, [field]: formatted }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Validation
  const validateForm = () => {
    const errors = {};

    // Website Name
    if (!formData.siteName || !formData.siteName.trim()) {
      errors.siteName = "Website Name is required";
    } else if (formData.siteName.trim().length < 2) {
      errors.siteName = "Website Name must be at least 2 characters";
    } else if (formData.siteName.trim().length > 80) {
      errors.siteName = "Website Name cannot exceed 80 characters";
    }

    // Logo & Favicon URLs
    if (formData.logoUrl && !isValidUrlOrPath(formData.logoUrl.trim())) {
      errors.logoUrl = "Please enter a valid URL or relative asset path (e.g. /logo.png)";
    }
    if (formData.faviconUrl && !isValidUrlOrPath(formData.faviconUrl.trim())) {
      errors.faviconUrl = "Please enter a valid URL or relative asset path (e.g. /favicon.ico)";
    }

    // Contact Email
    if (formData.contactEmail && formData.contactEmail.trim() && !isValidEmail(formData.contactEmail.trim())) {
      errors.contactEmail = "Please enter a valid email address";
    }

    // Colors
    if (!isValidHex(formData.primaryColor)) {
      errors.primaryColor = "Please enter a valid 3 or 6-digit Hex color (e.g. #2563eb)";
    }
    if (!isValidHex(formData.secondaryColor)) {
      errors.secondaryColor = "Please enter a valid 3 or 6-digit Hex color (e.g. #0f172a)";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      addToast("Please correct the form errors before saving", "error");
      return;
    }

    setIsSaving(true);
    try {
      const sanitized = {
        ...formData,
        siteName: formData.siteName.trim(),
        siteTagline: formData.siteTagline.trim(),
        logoUrl: formData.logoUrl.trim(),
        faviconUrl: formData.faviconUrl.trim(),
        contactEmail: formData.contactEmail.trim(),
        contactPhone: formData.contactPhone.trim(),
        whatsappNumber: formData.whatsappNumber.trim(),
        telegramChannel: formData.telegramChannel.trim(),
        primaryColor: formData.primaryColor.trim(),
        secondaryColor: formData.secondaryColor.trim(),
      };

      await adminService.updateWebsiteSettings(sanitized);
      setSavedData(sanitized);
      setFormData(sanitized);
      addToast("Website settings and branding saved successfully", "success");
    } catch (err) {
      const msg = err?.message || "Failed to save website settings";
      addToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reset to last saved state
  const handleReset = () => {
    if (isDirty) {
      if (
        window.confirm(
          "Are you sure you want to discard your unsaved changes and reset back to the saved configuration?"
        )
      ) {
        setFormData(savedData);
        setFormErrors({});
        setLogoError(false);
        setFaviconError(false);
        addToast("Settings reset to last saved state", "info");
      }
    }
  };

  // Handle Refresh with guard
  const handleRefreshClick = () => {
    if (isDirty) {
      if (
        window.confirm(
          "You have unsaved changes. Refreshing will discard these changes. Continue?"
        )
      ) {
        loadSettings(true);
      }
    } else {
      loadSettings(true);
    }
  };

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <FaSlidersH className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                  Website & Branding Settings
                </h1>
                {isDirty && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Configure brand identity, logo assets, customer support channels, palette, and custom scripts
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshClick}
            disabled={loading || refreshing || isSaving}
            aria-label="Refresh website settings"
            title="Reload settings from storage"
            icon={
              <FaSync
                className={refreshing ? "animate-spin text-blue-600" : ""}
              />
            }
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              icon={<FaUndo className="text-gray-500" />}
              title="Discard unsaved changes"
            >
              Reset
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<FaSave />}
            onClick={handleSave}
            isLoading={isSaving}
            disabled={loading}
            aria-label="Save website settings"
          >
            Save Settings
          </Button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-xl text-rose-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Failed to Load Website Settings</h4>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => loadSettings(false)}
            icon={<FaUndo />}
            className="border-rose-300 text-rose-700 hover:bg-rose-100 flex-shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Settings Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. Website Identity */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Website Identity
            </p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FaGlobe className="text-base" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mt-2 truncate">
            {loading ? <Skeleton className="h-6 w-32" /> : formData.siteName || "Unnamed"}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            {formData.siteTagline || "No tagline configured"}
          </p>
        </div>

        {/* 2. Customer Support */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Support Channels
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FaPhoneAlt className="text-base" />
            </div>
          </div>
          <h3 className="text-sm font-bold text-gray-900 mt-2 truncate">
            {loading ? (
              <Skeleton className="h-6 w-36" />
            ) : (
              formData.contactEmail || formData.contactPhone || "Not configured"
            )}
          </h3>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
            {formData.whatsappNumber ? "WhatsApp active" : "Support info configured"}
          </p>
        </div>

        {/* 3. Branding Palette */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Branding Palette
            </p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FaPalette className="text-base" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div
              className="w-5 h-5 rounded-md border border-gray-300 shadow-xs"
              style={{ backgroundColor: isValidHex(formData.primaryColor) ? formData.primaryColor : "#2563eb" }}
              title={`Primary: ${formData.primaryColor}`}
            />
            <span className="font-mono text-xs font-bold text-gray-800">
              {formData.primaryColor}
            </span>
            <div
              className="w-5 h-5 rounded-md border border-gray-300 shadow-xs ml-2"
              style={{ backgroundColor: isValidHex(formData.secondaryColor) ? formData.secondaryColor : "#0f172a" }}
              title={`Secondary: ${formData.secondaryColor}`}
            />
            <span className="font-mono text-xs font-bold text-gray-800">
              {formData.secondaryColor}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Theme & navigation accent colors</p>
        </div>

        {/* 4. Custom Scripts */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Custom Scripts
            </p>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FaCode className="text-base" />
            </div>
          </div>
          <h3 className="text-sm font-bold text-gray-900 mt-2">
            {loading ? (
              <Skeleton className="h-6 w-24" />
            ) : formData.headerScripts || formData.footerScripts ? (
              <span className="text-purple-700 font-semibold flex items-center gap-1">
                <FaCheckCircle className="text-xs text-purple-600" /> Tags Configured
              </span>
            ) : (
              <span className="text-gray-400 font-normal">None configured</span>
            )}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Header & footer tracking injections
          </p>
        </div>
      </div>

      {/* Main Settings Form */}
      {loading && !formData.siteName ? (
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <Skeleton className="h-5 w-48" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: General Brand Identity */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FaSlidersH className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    General Brand Identity
                  </h3>
                  <p className="text-xs text-gray-500">
                    Main website title, meta tagline, logo, and browser favicon assets
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Website Name"
                  required
                  value={formData.siteName}
                  onChange={(e) => handleChange("siteName", e.target.value)}
                  error={formErrors.siteName}
                  placeholder="e.g. Gromage SMM Panel"
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  {formData.siteName.length} / 80 characters
                </span>
              </div>

              <div>
                <Input
                  label="Website Tagline"
                  value={formData.siteTagline}
                  onChange={(e) => handleChange("siteTagline", e.target.value)}
                  error={formErrors.siteTagline}
                  placeholder="e.g. India's #1 Social Media Marketing Provider"
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  {formData.siteTagline.length} / 150 characters
                </span>
              </div>

              {/* Logo URL with Live Preview */}
              <div>
                <Input
                  label="Logo Image URL"
                  value={formData.logoUrl}
                  placeholder="/logo.png or https://..."
                  onChange={(e) => handleChange("logoUrl", e.target.value)}
                  error={formErrors.logoUrl}
                />
                <div className="mt-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                  <div className="w-16 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                    {formData.logoUrl && !logoError ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo preview"
                        className="max-h-full max-w-full object-contain"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <FaImage className="text-gray-300 text-lg" />
                    )}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-gray-700">Logo Preview</p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {formData.logoUrl ? (logoError ? "Image failed to load" : "Asset loaded") : "No logo URL provided"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Favicon URL with Live Preview */}
              <div>
                <Input
                  label="Favicon URL"
                  value={formData.faviconUrl}
                  placeholder="/favicon.ico or https://..."
                  onChange={(e) => handleChange("faviconUrl", e.target.value)}
                  error={formErrors.faviconUrl}
                />
                <div className="mt-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                    {formData.faviconUrl && !faviconError ? (
                      <img
                        src={formData.faviconUrl}
                        alt="Favicon preview"
                        className="w-6 h-6 object-contain"
                        onError={() => setFaviconError(true)}
                      />
                    ) : (
                      <FaGlobe className="text-gray-300 text-base" />
                    )}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-gray-700">Favicon Preview</p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {formData.faviconUrl ? (faviconError ? "Favicon failed to load" : "16x16 / 32x32 icon") : "No favicon URL provided"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Social Channels */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FaPhoneAlt className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Customer Support & Social Channels
                  </h3>
                  <p className="text-xs text-gray-500">
                    Public contact email, phone helpline, direct WhatsApp support, and Telegram channel
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Support Email"
                  type="email"
                  value={formData.contactEmail}
                  placeholder="support@example.com"
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  error={formErrors.contactEmail}
                  icon={<FaEnvelope className="text-gray-400 text-xs" />}
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Displayed on public footer and contact pages
                </span>
              </div>

              <div>
                <Input
                  label="Support Phone Helpline"
                  value={formData.contactPhone}
                  placeholder="+91 98765 43210"
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  icon={<FaPhoneAlt className="text-gray-400 text-xs" />}
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Calling helpline for general enquiries
                </span>
              </div>

              <div>
                <Input
                  label="WhatsApp Support Number"
                  placeholder="+91 98765 43210"
                  value={formData.whatsappNumber}
                  onChange={(e) => handleChange("whatsappNumber", e.target.value)}
                  icon={<FaWhatsapp className="text-emerald-500 text-sm" />}
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Used for the floating WhatsApp button on user portal
                </span>
              </div>

              <div>
                <Input
                  label="Telegram Channel / Support Bot Link"
                  placeholder="https://t.me/gromage_support"
                  value={formData.telegramChannel}
                  onChange={(e) => handleChange("telegramChannel", e.target.value)}
                  icon={<FaTelegram className="text-sky-500 text-sm" />}
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Official Telegram broadcast channel or customer bot
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Branding Palette & Live Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FaPaintBrush className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Branding Palette & Live Theme Preview
                  </h3>
                  <p className="text-xs text-gray-500">
                    Customize primary brand color, dark navbar accents, and verify live appearance
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Color pickers */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Brand Color <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={isValidHex(formData.primaryColor) ? formData.primaryColor : "#2563eb"}
                      onChange={(e) => handleChange("primaryColor", e.target.value)}
                      className="w-11 h-11 rounded-xl border border-gray-300 p-1 cursor-pointer bg-white shadow-2xs"
                      title="Select primary color"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => handleColorTextChange("primaryColor", e.target.value)}
                      placeholder="#2563eb"
                      maxLength={7}
                      className={`w-40 rounded-xl border px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.primaryColor ? "border-rose-400 bg-rose-50/30" : "border-gray-300 bg-white"
                      }`}
                    />
                    <span className="text-xs text-gray-500">
                      Buttons, active links & highlights
                    </span>
                  </div>
                  {formErrors.primaryColor && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.primaryColor}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary / Header Dark Color <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={isValidHex(formData.secondaryColor) ? formData.secondaryColor : "#0f172a"}
                      onChange={(e) => handleChange("secondaryColor", e.target.value)}
                      className="w-11 h-11 rounded-xl border border-gray-300 p-1 cursor-pointer bg-white shadow-2xs"
                      title="Select secondary color"
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => handleColorTextChange("secondaryColor", e.target.value)}
                      placeholder="#0f172a"
                      maxLength={7}
                      className={`w-40 rounded-xl border px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.secondaryColor ? "border-rose-400 bg-rose-50/30" : "border-gray-300 bg-white"
                      }`}
                    />
                    <span className="text-xs text-gray-500">
                      Header bar, top navigation & footer
                    </span>
                  </div>
                  {formErrors.secondaryColor && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.secondaryColor}</p>
                  )}
                </div>
              </div>

              {/* Live UI Simulation Preview Box */}
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Live UI Preview Simulation
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Real-time render
                  </span>
                </div>

                {/* Simulated Header Bar */}
                <div
                  className="rounded-xl p-3 shadow-md transition-colors"
                  style={{ backgroundColor: isValidHex(formData.secondaryColor) ? formData.secondaryColor : "#0f172a" }}
                >
                  <div className="flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold tracking-tight text-sm">
                        {formData.siteName || "Gromage"}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold"
                        style={{ backgroundColor: isValidHex(formData.primaryColor) ? formData.primaryColor : "#2563eb" }}
                      >
                        PANEL
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-300 hidden sm:inline">Services</span>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-lg text-white font-bold text-[11px] shadow-sm transition"
                        style={{ backgroundColor: isValidHex(formData.primaryColor) ? formData.primaryColor : "#2563eb" }}
                      >
                        New Order
                      </button>
                    </div>
                  </div>
                </div>

                {/* Simulated Hero / Card snippet */}
                <div className="mt-3 p-3 bg-white rounded-xl border border-gray-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-800">
                      {formData.siteTagline || "Automated SMM Services"}
                    </span>
                    <span
                      className="font-mono font-bold text-[11px]"
                      style={{ color: isValidHex(formData.primaryColor) ? formData.primaryColor : "#2563eb" }}
                    >
                      Instant Start
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {formData.contactEmail ? `Support: ${formData.contactEmail}` : "24/7 Customer Assistance"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Custom Header & Footer Scripts */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <FaCode className="text-base" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Custom Scripts & Tracking Tags
                  </h3>
                  <p className="text-xs text-gray-500">
                    Add Google Analytics, Meta Pixel, live chat widgets, or custom stylesheet links
                  </p>
                </div>
              </div>
            </div>

            {/* Safety Warning */}
            <div className="mb-4 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <FaInfoCircle className="text-blue-600 text-sm mt-0.5 flex-shrink-0" />
              <p>
                <strong>Configuration Note:</strong> Scripts entered below are stored safely as configuration data and will be injected into public customer routes upon production backend connection. Scripts are not executed inside this administrator panel.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Header Scripts <span className="font-mono text-xs text-gray-400">(&lt;head&gt;)</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {formData.headerScripts ? formData.headerScripts.length : 0} chars
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={formData.headerScripts}
                  placeholder="<!-- Google Analytics (gtag.js), Google Tag Manager, Meta Pixel -->&#10;<script async src=&quot;https://www.googletagmanager.com/gtag/js?id=G-XXXXX&quot;></script>"
                  onChange={(e) => handleChange("headerScripts", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed bg-gray-50/50 focus:bg-white transition"
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Injected before the closing &lt;/head&gt; tag
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Footer Scripts <span className="font-mono text-xs text-gray-400">(&lt;/body&gt;)</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {formData.footerScripts ? formData.footerScripts.length : 0} chars
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={formData.footerScripts}
                  placeholder="<!-- Live Chat widget, Crisp, Tawk.to, Custom Analytics -->&#10;<script>&#10;  window.supportChat = { app: 'gromage' };&#10;</script>"
                  onChange={(e) => handleChange("footerScripts", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed bg-gray-50/50 focus:bg-white transition"
                />
                <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                  Injected before the closing &lt;/body&gt; tag
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              {isDirty ? (
                <span className="text-amber-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  You have unsaved changes in website settings.
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <FaCheckCircle className="text-emerald-600" />
                  All website settings are up to date.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDirty && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  Discard Changes
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                type="submit"
                icon={<FaSave />}
                isLoading={isSaving}
                disabled={loading}
              >
                Save Website Settings
              </Button>
            </div>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}

export default AdminWebsiteSettings;
