/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { translations } from "../i18n/translations";

const LanguageContext = createContext();

export const normalizeLanguage = (lang) => {
  if (!lang || typeof lang !== "string") return "English";
  const trimmed = lang.trim().toLowerCase();
  if (trimmed === "hindi" || trimmed === "hi") return "Hindi";
  if (trimmed === "marathi" || trimmed === "mr") return "Marathi";
  return "English";
};

const resolveCustomerLanguage = (user) => {
  try {
    const uid = user?._id || user?.id || user?.email;
    if (uid && uid !== "default") {
      const storedSettings = localStorage.getItem(`customer_settings_${uid}`);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed?.language) return normalizeLanguage(parsed.language);
      }
      const directLang = localStorage.getItem(`customer_language_${uid}`);
      if (directLang) return normalizeLanguage(directLang);
    }
    const fallback = localStorage.getItem("customer_language");
    if (fallback) return normalizeLanguage(fallback);
  } catch (err) {
    console.warn("Error reading customer language from storage:", err);
  }
  return "English";
};

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  const customerId = user?._id || user?.id || user?.email || "default";

  const [language, setLanguageState] = useState(() => resolveCustomerLanguage(user));

  // Sync language when active authenticated customer changes
  useEffect(() => {
    const activeLang = resolveCustomerLanguage(user);
    setLanguageState(activeLang);
  }, [user]);

  // Listen for live language change events across the application
  useEffect(() => {
    const handleLanguageChange = (e) => {
      const newLang = e.detail?.language;
      if (newLang) {
        setLanguageState(normalizeLanguage(newLang));
      }
    };

    const handleStorageChange = (e) => {
      if (
        e.key === "customer_language" ||
        (e.key && e.key.startsWith("customer_language_")) ||
        (e.key && e.key.startsWith("customer_settings_"))
      ) {
        const activeLang = resolveCustomerLanguage(user);
        setLanguageState(activeLang);
      }
    };

    window.addEventListener("customer_language_change", handleLanguageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("customer_language_change", handleLanguageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user]);

  const changeLanguage = useCallback((newLang) => {
    const normalized = normalizeLanguage(newLang);
    setLanguageState(normalized);

    try {
      // 1. Persist globally and per-customer
      localStorage.setItem("customer_language", normalized);
      if (customerId && customerId !== "default") {
        localStorage.setItem(`customer_language_${customerId}`, normalized);

        // Update settings payload if exists
        const settingsKey = `customer_settings_${customerId}`;
        const existingSettingsStr = localStorage.getItem(settingsKey);
        let settingsPayload = {};
        if (existingSettingsStr) {
          try {
            settingsPayload = JSON.parse(existingSettingsStr);
          } catch {
            settingsPayload = {};
          }
        }
        settingsPayload.language = normalized;
        settingsPayload.updatedAt = new Date().toISOString();
        localStorage.setItem(settingsKey, JSON.stringify(settingsPayload));
      }

      // 2. Dispatch live event so all components react immediately
      window.dispatchEvent(
        new CustomEvent("customer_language_change", {
          detail: { language: normalized, customerId },
        })
      );
    } catch (err) {
      console.warn("Failed to persist language preference:", err);
    }
  }, [customerId]);

  const t = useCallback((key, fallback) => {
    if (!key) return "";
    const langDict = translations[language];
    if (langDict && langDict[key] !== undefined) {
      return langDict[key];
    }
    const englishDict = translations.English;
    if (englishDict && englishDict[key] !== undefined) {
      return englishDict[key];
    }
    return fallback !== undefined ? fallback : key;
  }, [language]);

  const contextValue = useMemo(() => ({
    language,
    changeLanguage,
    setLanguage: changeLanguage,
    t,
  }), [language, changeLanguage, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: "English",
      changeLanguage: () => {},
      setLanguage: () => {},
      t: (key, fallback) => (fallback !== undefined ? fallback : key),
    };
  }
  return context;
}

export function useTranslation() {
  return useLanguage();
}

export default LanguageContext;
