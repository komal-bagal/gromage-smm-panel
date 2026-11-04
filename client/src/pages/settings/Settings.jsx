import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

const loadSavedSettings = (storageKey, customerId) => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        theme: parsed.theme === "dark" ? "dark" : "light",
        emailNotifications:
          typeof parsed.emailNotifications === "boolean"
            ? parsed.emailNotifications
            : true,
        smsNotifications:
          typeof parsed.smsNotifications === "boolean"
            ? parsed.smsNotifications
            : false,
        language: parsed.language || "English",
      };
    }

    // Check customer-specific theme key
    if (customerId && customerId !== "default") {
      const userTheme = localStorage.getItem(`customer_theme_${customerId}`);
      return {
        theme: userTheme === "dark" ? "dark" : "light",
        emailNotifications: true,
        smsNotifications: false,
        language: "English",
      };
    }

    // Only unauthenticated/guest fallback to legacy key
    const legacyTheme = localStorage.getItem("customer_theme");
    return {
      theme: legacyTheme === "dark" ? "dark" : "light",
      emailNotifications: true,
      smsNotifications: false,
      language: "English",
    };
  } catch {
    return {
      theme: "light",
      emailNotifications: true,
      smsNotifications: false,
      language: "English",
    };
  }
};

function Settings() {
  const { user } = useAuth();
  const { language: currentLang, changeLanguage, t } = useLanguage();

  // Active customer identifier for isolated preference storage
  const activeUser = useMemo(() => {
    if (user) return user;
    try {
      const stored =
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem("user")) ||
        (typeof localStorage !== "undefined" && localStorage.getItem("user"));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [user]);

  const customerId = activeUser?._id || activeUser?.id || activeUser?.email || "default";
  const storageKey = `customer_settings_${customerId}`;

  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  const [theme, setTheme] = useState(() => loadSavedSettings(storageKey, customerId).theme);
  const [emailNotifications, setEmailNotifications] = useState(
    () => loadSavedSettings(storageKey, customerId).emailNotifications
  );
  const [smsNotifications, setSmsNotifications] = useState(
    () => loadSavedSettings(storageKey, customerId).smsNotifications
  );
  const [language, setLanguage] = useState(
    () => loadSavedSettings(storageKey, customerId).language || currentLang || "English"
  );
  const [statusMessage, setStatusMessage] = useState(null);

  // Sync state during render if customer account changes
  if (prevCustomerId !== customerId) {
    setPrevCustomerId(customerId);
    const s = loadSavedSettings(storageKey, customerId);
    setTheme(s.theme);
    setEmailNotifications(s.emailNotifications);
    setSmsNotifications(s.smsNotifications);
    setLanguage(s.language);
  }

  // Also sync language if global context changes
  useEffect(() => {
    if (currentLang && currentLang !== language) {
      setLanguage(currentLang);
    }
  }, [currentLang]);

  // Handle Theme Selection with instant live preview
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    window.dispatchEvent(
      new CustomEvent("customer_theme_change", {
        detail: { theme: newTheme, customerId, preview: true },
      })
    );
  };

  const handleSave = () => {
    try {
      const selectedLang = language || "English";
      const payload = {
        theme,
        emailNotifications: Boolean(emailNotifications),
        smsNotifications: Boolean(smsNotifications),
        language: selectedLang,
        updatedAt: new Date().toISOString(),
      };

      // 1. Persist isolated customer settings
      localStorage.setItem(storageKey, JSON.stringify(payload));
      localStorage.setItem(`customer_language_${customerId}`, selectedLang);
      localStorage.setItem("customer_language", selectedLang);

      // 2. Sync theme keys for layout initialization
      localStorage.setItem("customer_theme", theme);
      if (customerId !== "default") {
        localStorage.setItem(`customer_theme_${customerId}`, theme);
      }

      // 3. Dispatch event to apply theme across layout
      window.dispatchEvent(
        new CustomEvent("customer_theme_change", {
          detail: { theme, customerId, settings: payload },
        })
      );

      // 4. Update translation context to apply language across the entire application instantly
      if (changeLanguage) {
        changeLanguage(selectedLang);
      }

      setStatusMessage({
        type: "success",
        text: t("settings.save_success", "Settings preferences saved successfully!"),
      });

      const timer = setTimeout(() => {
        setStatusMessage(null);
      }, 3500);

      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Save Settings Error:", err);
      setStatusMessage({
        type: "error",
        text: t("settings.save_error", "Failed to save settings. Please try again."),
      });
    }
  };

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-slate-100 mb-5 sm:mb-8 transition-colors">
        {t("settings.title", "Settings")}
      </h1>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-100 rounded-xl shadow p-4 sm:p-6 lg:p-8 max-w-4xl transition-colors">
        {statusMessage && (
          <div
            className={`p-3.5 rounded-lg mb-6 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {statusMessage.type === "success" ? "✅ " : "❌ "}
            {statusMessage.text}
          </div>
        )}

        {/* 1. Interface Theme */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-slate-200 mb-3">
            {t("settings.theme_title", "Interface Theme")}
          </h2>

          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === "light"}
                onChange={() => handleThemeChange("light")}
                className="accent-blue-600 cursor-pointer"
              />
              {t("settings.theme_light", "Light Theme (Default)")}
            </label>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === "dark"}
                onChange={() => handleThemeChange("dark")}
                className="accent-blue-600 cursor-pointer"
              />
              {t("settings.theme_dark", "Dark Theme (Experimental)")}
            </label>
          </div>
        </div>

        {/* 2. Notification Preferences */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-slate-200 mb-3">
            {t("settings.notif_title", "Notification Preferences")}
          </h2>

          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="accent-blue-600 rounded cursor-pointer"
              />
              {t("settings.notif_email", "Email Order Notifications & Updates")}
            </label>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={smsNotifications}
                onChange={(e) => setSmsNotifications(e.target.checked)}
                className="accent-blue-600 rounded cursor-pointer"
              />
              {t("settings.notif_sms", "SMS Status Alerts")}
            </label>
          </div>
        </div>

        {/* 3. Interface Language */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-slate-200 mb-3">
            {t("settings.lang_title", "Interface Language")}
          </h2>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg p-2.5 sm:p-3 text-sm w-full outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-medium max-w-sm cursor-pointer"
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi (हिंदी)</option>
            <option value="Marathi">Marathi (मराठी)</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
            {t("settings.lang_desc", "Default display language for customer dashboard operations.")}
          </p>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition cursor-pointer text-sm shadow"
        >
          {t("settings.save_btn", "Save Settings")}
        </button>
      </div>
    </DashboardLayout>
  );
}

export default Settings;
