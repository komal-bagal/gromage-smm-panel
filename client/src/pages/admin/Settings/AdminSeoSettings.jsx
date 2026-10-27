/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaSave,
  FaSearch,
  FaGlobe,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSync,
  FaCopy,
  FaUndo,
  FaRobot,
  FaImage,
  FaFileCode,
  FaInfoCircle,
} from "react-icons/fa";

import AdminLayout from "../../../components/admin/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { Skeleton } from "../../../components/ui/Loader";
import { useToast } from "../../../components/ui/Toast";
import adminService from "../../../services/adminService";

const DEFAULT_SEO = {
  metaTitle: "Gromage SMM Panel - #1 Main Wholesale SMM Provider",
  metaDescription:
    "Boost your social media presence with Gromage SMM Panel. Instant delivery for Instagram, YouTube, Telegram & Facebook services at wholesale rates.",
  metaKeywords:
    "smm panel, wholesale smm, buy instagram followers, youtube views, telegram members, cheap smm reseller panel",
  ogImageUrl:
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=630&auto=format&fit=crop&q=80",
  canonicalUrl: "https://gromage.com",
  robotsIndex: true,
  robotsFollow: true,
  sitemapPath: "/sitemap.xml",
};

// Helper: validate absolute URL
function isValidUrl(str) {
  if (!str) return true;
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function AdminSeoSettings() {
  const { addToast } = useToast();

  // Settings states
  const [formData, setFormData] = useState(DEFAULT_SEO);
  const [savedData, setSavedData] = useState(DEFAULT_SEO);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Image preview state
  const [imageError, setImageError] = useState(false);
  const [copiedSitemap, setCopiedSitemap] = useState(false);

  // Load SEO Settings
  const loadSettings = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await adminService.getSeoSettings();
        if (data) {
          const merged = { ...DEFAULT_SEO, ...data };
          setFormData(merged);
          setSavedData(merged);
          setImageError(false);
          setFormErrors({});
          if (isManual) {
            addToast("SEO settings refreshed successfully", "success");
          }
        }
      } catch (err) {
        const msg = err?.message || "Failed to load SEO metadata settings";
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
      formData.metaTitle !== savedData.metaTitle ||
      formData.metaDescription !== savedData.metaDescription ||
      formData.metaKeywords !== savedData.metaKeywords ||
      formData.ogImageUrl !== savedData.ogImageUrl ||
      formData.canonicalUrl !== savedData.canonicalUrl ||
      formData.robotsIndex !== savedData.robotsIndex ||
      formData.robotsFollow !== savedData.robotsFollow
    );
  }, [formData, savedData]);

  // Form field handler
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (field === "ogImageUrl") {
      setImageError(false);
    }
  };

  // Derived Title Quality Indicator
  const titleQuality = useMemo(() => {
    const len = formData.metaTitle.trim().length;
    if (len === 0) return { label: "Required", color: "text-rose-600 bg-rose-50 border-rose-200" };
    if (len >= 50 && len <= 60) {
      return { label: "Optimal (50–60 chars)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
    if (len < 50) {
      return { label: `${len} chars (Short, 50–60 recommended)`, color: "text-amber-700 bg-amber-50 border-amber-200" };
    }
    return { label: `${len} chars (May truncate on SERP)`, color: "text-amber-700 bg-amber-50 border-amber-200" };
  }, [formData.metaTitle]);

  // Derived Description Quality Indicator
  const descQuality = useMemo(() => {
    const len = formData.metaDescription.trim().length;
    if (len === 0) return { label: "Required", color: "text-rose-600 bg-rose-50 border-rose-200" };
    if (len >= 140 && len <= 160) {
      return { label: "Optimal (140–160 chars)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
    if (len < 140) {
      return { label: `${len} chars (Short, 150–160 recommended)`, color: "text-amber-700 bg-amber-50 border-amber-200" };
    }
    return { label: `${len} chars (May truncate with ellipses)`, color: "text-amber-700 bg-amber-50 border-amber-200" };
  }, [formData.metaDescription]);

  // Parsed Keywords Count
  const keywordCount = useMemo(() => {
    if (!formData.metaKeywords.trim()) return 0;
    return formData.metaKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean).length;
  }, [formData.metaKeywords]);

  // Generated Robots Meta Tag Directive
  const robotsDirective = useMemo(() => {
    const idx = formData.robotsIndex ? "index" : "noindex";
    const flw = formData.robotsFollow ? "follow" : "nofollow";
    return `${idx}, ${flw}`;
  }, [formData.robotsIndex, formData.robotsFollow]);

  // Form Validation
  const validateForm = () => {
    const errors = {};

    if (!formData.metaTitle || !formData.metaTitle.trim()) {
      errors.metaTitle = "Meta Title is required";
    } else if (formData.metaTitle.trim().length < 5) {
      errors.metaTitle = "Meta Title must be at least 5 characters";
    } else if (formData.metaTitle.trim().length > 100) {
      errors.metaTitle = "Meta Title cannot exceed 100 characters";
    }

    if (!formData.metaDescription || !formData.metaDescription.trim()) {
      errors.metaDescription = "Meta Description is required";
    } else if (formData.metaDescription.trim().length < 20) {
      errors.metaDescription = "Meta Description must be at least 20 characters";
    } else if (formData.metaDescription.trim().length > 300) {
      errors.metaDescription = "Meta Description cannot exceed 300 characters";
    }

    if (formData.canonicalUrl && !isValidUrl(formData.canonicalUrl.trim())) {
      errors.canonicalUrl = "Please enter a valid absolute URL (e.g. https://gromage.com)";
    }

    if (formData.ogImageUrl && !isValidUrl(formData.ogImageUrl.trim())) {
      errors.ogImageUrl = "Please enter a valid image URL (e.g. https://example.com/banner.png)";
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
        metaTitle: formData.metaTitle.trim(),
        metaDescription: formData.metaDescription.trim(),
        metaKeywords: formData.metaKeywords.trim(),
        canonicalUrl: formData.canonicalUrl.trim(),
        ogImageUrl: formData.ogImageUrl.trim(),
        ogImage: formData.ogImageUrl.trim(),
      };

      await adminService.updateSeoSettings(sanitized);
      setSavedData(sanitized);
      setFormData(sanitized);
      addToast("SEO and metadata settings saved successfully", "success");
    } catch (err) {
      const msg = err?.message || "Failed to save SEO settings";
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
        setImageError(false);
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

  // Copy Sitemap URL
  const handleCopySitemap = () => {
    const fullSitemap = `${formData.canonicalUrl || "https://gromage.com"}/sitemap.xml`;
    navigator.clipboard.writeText(fullSitemap);
    setCopiedSitemap(true);
    addToast("Sitemap URL copied to clipboard", "info");
    setTimeout(() => setCopiedSitemap(false), 2000);
  };

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <FaSearch className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                  SEO & Metadata Settings
                </h1>
                {isDirty && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved changes
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Optimize search engine rankings, OpenGraph social cards, canonical references, and indexing robots
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshClick}
            disabled={loading || refreshing || isSaving}
            aria-label="Refresh SEO settings"
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
            aria-label="Save SEO settings"
          >
            Save SEO Settings
          </Button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-xl text-rose-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Failed to Load SEO Settings</h4>
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. Meta Title Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Meta Title
            </p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FaGlobe className="text-base" />
            </div>
          </div>
          <h3 className="text-base font-bold text-gray-900 mt-2 truncate">
            {loading ? <Skeleton className="h-6 w-32" /> : formData.metaTitle || "Not set"}
          </h3>
          <div className="mt-1">
            <span
              className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${titleQuality.color}`}
            >
              {titleQuality.label}
            </span>
          </div>
        </div>

        {/* 2. Meta Description Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Meta Description
            </p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FaSearch className="text-base" />
            </div>
          </div>
          <h3 className="text-xs font-medium text-gray-700 mt-2 line-clamp-1">
            {loading ? <Skeleton className="h-6 w-36" /> : formData.metaDescription || "Not configured"}
          </h3>
          <div className="mt-1">
            <span
              className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded border ${descQuality.color}`}
            >
              {descQuality.label}
            </span>
          </div>
        </div>

        {/* 3. Canonical URL Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Canonical URL
            </p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FaCheckCircle className="text-base" />
            </div>
          </div>
          <h3 className="text-xs font-mono font-bold text-gray-900 mt-2 truncate">
            {loading ? <Skeleton className="h-6 w-28" /> : formData.canonicalUrl || "Not set"}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">
            {isValidUrl(formData.canonicalUrl) ? "Valid URL format" : "Invalid URL"}
          </p>
        </div>

        {/* 4. Robots Directives Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              Robots Directives
            </p>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FaRobot className="text-base" />
            </div>
          </div>
          <h3 className="text-sm font-mono font-bold text-purple-900 mt-2">
            {loading ? <Skeleton className="h-6 w-24" /> : robotsDirective}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                formData.robotsIndex ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span className="text-gray-600 font-medium">
              {formData.robotsIndex ? "Crawlers allowed" : "Crawlers blocked"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: SEO Form on Left, SERP Preview on Right */}
      {loading && !formData.metaTitle ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metadata Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="border-b border-gray-100 pb-3 mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FaGlobe className="text-blue-600" />
                    Global Meta Information
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Search engine titles, descriptions, keywords, and canonical addresses
                  </p>
                </div>
              </div>

              {/* Meta Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Global Meta Title <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${titleQuality.color}`}>
                    {titleQuality.label}
                  </span>
                </div>
                <Input
                  required
                  value={formData.metaTitle}
                  onChange={(e) => handleChange("metaTitle", e.target.value)}
                  error={formErrors.metaTitle}
                  placeholder="e.g. Gromage SMM Panel - #1 Main Wholesale SMM Provider"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Recommended title length is 50–60 characters. Search engines typically display the first 55–60 characters in search results.
                </p>
              </div>

              {/* Meta Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Meta Description <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${descQuality.color}`}>
                    {descQuality.label}
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={formData.metaDescription}
                  onChange={(e) => handleChange("metaDescription", e.target.value)}
                  placeholder="Enter a compelling summary of your SMM panel services for search results..."
                  className={`w-full rounded-xl border p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed transition ${
                    formErrors.metaDescription ? "border-rose-400 bg-rose-50/30" : "border-gray-300 bg-white"
                  }`}
                />
                {formErrors.metaDescription ? (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.metaDescription}</p>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Optimal description length is 140–160 characters. Summarize your value proposition clearly to maximize click-through rates.
                  </p>
                )}
              </div>

              {/* Meta Keywords */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Meta Keywords <span className="text-xs text-gray-400 font-normal">(Comma separated)</span>
                  </label>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {keywordCount} tags parsed
                  </span>
                </div>
                <Input
                  value={formData.metaKeywords}
                  placeholder="smm panel, cheap followers, youtube views, telegram members..."
                  onChange={(e) => handleChange("metaKeywords", e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Separate keywords with commas. Used as auxiliary metadata references.
                </p>
              </div>

              {/* Canonical URL & OG Banner Image URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <Input
                    label="Canonical URL"
                    value={formData.canonicalUrl}
                    placeholder="https://gromage.com"
                    onChange={(e) => handleChange("canonicalUrl", e.target.value)}
                    error={formErrors.canonicalUrl}
                    icon={<FaGlobe className="text-gray-400 text-xs" />}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Prevents duplicate content issues across domain aliases
                  </p>
                </div>

                <div>
                  <Input
                    label="OpenGraph Social Banner URL"
                    value={formData.ogImageUrl}
                    placeholder="https://example.com/banner.png"
                    onChange={(e) => handleChange("ogImageUrl", e.target.value)}
                    error={formErrors.ogImageUrl}
                    icon={<FaImage className="text-gray-400 text-xs" />}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Recommended ratio: 1200 x 630 px for social share previews
                  </p>
                </div>
              </div>

              {/* OpenGraph Image Preview Box */}
              {formData.ogImageUrl && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
                  <div className="w-24 h-14 bg-white rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center shadow-2xs">
                    {!imageError ? (
                      <img
                        src={formData.ogImageUrl}
                        alt="Social banner preview"
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <FaImage className="text-gray-300 text-xl" />
                    )}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-gray-700">OpenGraph Social Preview</p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {imageError ? "Image failed to load" : "Social banner loaded"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Robots Configuration Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <FaRobot className="text-base" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Search Engine Robots & Indexing Controls
                    </h3>
                    <p className="text-xs text-gray-500">
                      Instruct web crawlers whether to index public pages and follow hyperlinks
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
                  {robotsDirective}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={formData.robotsIndex}
                    onChange={(e) => handleChange("robotsIndex", e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">
                      Allow Indexing <span className="font-mono text-xs text-blue-600">(index)</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      Permits Google, Bing, and search engines to index your pages in search results.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={formData.robotsFollow}
                    onChange={(e) => handleChange("robotsFollow", e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">
                      Follow Hyperlinks <span className="font-mono text-xs text-blue-600">(follow)</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      Instructs crawlers to follow links on your pages to discover connected public content.
                    </span>
                  </div>
                </label>
              </div>

              {/* Generated HTML tag snippet */}
              <div className="p-3 bg-gray-900 text-gray-200 rounded-xl text-xs font-mono">
                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                  <span>Generated HTML Meta Tag:</span>
                  <span>Direct Header Output</span>
                </div>
                <code>
                  &lt;meta name=&quot;robots&quot; content=&quot;{robotsDirective}&quot; /&gt;
                </code>
              </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                {isDirty ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    You have unsaved changes in SEO settings.
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <FaCheckCircle className="text-emerald-600" />
                    All SEO metadata settings are up to date.
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
                  Save SEO Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Live SERP Snippet Preview & XML Sitemap */}
          <div className="space-y-6">
            {/* Google SERP Snippet Preview */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs sticky top-20">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <FaSearch className="text-blue-500" />
                  Google SERP Snippet Preview
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">Illustrative</span>
              </div>

              {/* Simulated Google Search Result */}
              <div className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 text-left space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[9px] text-white font-bold">
                    G
                  </div>
                  <div className="text-xs text-gray-600 font-sans truncate">
                    <span className="text-gray-900 font-semibold">Gromage</span>
                    <span className="text-gray-400 mx-1">•</span>
                    <span className="font-mono text-gray-500 text-[11px]">
                      {formData.canonicalUrl || "https://gromage.com"}
                    </span>
                  </div>
                </div>

                <h4 className="text-base text-blue-700 font-medium hover:underline cursor-pointer leading-snug font-sans">
                  {formData.metaTitle || "Gromage SMM Panel - #1 Wholesale SMM Services"}
                </h4>

                <p className="text-xs text-gray-600 leading-relaxed font-sans line-clamp-3">
                  {formData.metaDescription ||
                    "Boost your social media growth with the leading automated SMM reseller panel. Wholesale pricing and instant delivery."}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                <span>Title: {formData.metaTitle.length}/60 chars</span>
                <span>Desc: {formData.metaDescription.length}/160 chars</span>
              </div>

              {/* XML Sitemap Section */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <FaFileCode className="text-purple-600" />
                    <span>XML Sitemap Reference</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between bg-purple-50/60 p-2.5 rounded-xl border border-purple-200/70 text-xs">
                  <code className="font-mono text-purple-900 truncate font-semibold">
                    {formData.canonicalUrl || "https://gromage.com"}/sitemap.xml
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySitemap}
                    className="p-1 text-purple-700 hover:text-purple-900 flex-shrink-0 ml-2 cursor-pointer"
                    title="Copy Sitemap URL"
                    aria-label="Copy Sitemap URL"
                  >
                    {copiedSitemap ? <FaCheckCircle className="text-emerald-600" /> : <FaCopy />}
                  </button>
                </div>

                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  Submit this sitemap URL in Google Search Console and Bing Webmaster Tools to accelerate page indexing.
                </p>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <FaInfoCircle className="text-gray-400" /> Standard XML format
                  </span>
                  <span className="font-mono">Auto-generated</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}

export default AdminSeoSettings;
