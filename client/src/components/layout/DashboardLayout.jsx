import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useAuth } from "../../context/AuthContext";

const getCustomerTheme = (user) => {
  try {
    const activeUser =
      user ||
      (() => {
        try {
          const s =
            (typeof sessionStorage !== "undefined" && sessionStorage.getItem("user")) ||
            (typeof localStorage !== "undefined" && localStorage.getItem("user"));
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();

    const uid = activeUser?._id || activeUser?.id || activeUser?.email;
    if (uid) {
      const stored = localStorage.getItem(`customer_settings_${uid}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.theme) return parsed.theme;
      }
      const userTheme = localStorage.getItem(`customer_theme_${uid}`);
      if (userTheme) return userTheme;
      return "light";
    }
    return localStorage.getItem("customer_theme") || "light";
  } catch {
    return "light";
  }
};

function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  const [prevUser, setPrevUser] = useState(user);
  const [currentTheme, setCurrentTheme] = useState(() => getCustomerTheme(user));

  // Sync theme during render if user reference changed
  if (prevUser !== user) {
    setPrevUser(user);
    setCurrentTheme(getCustomerTheme(user));
  }

  // Listen for customer_theme_change event and storage changes
  useEffect(() => {
    const handleThemeChange = (e) => {
      const newTheme = e.detail?.theme || getCustomerTheme(user);
      setCurrentTheme(newTheme);
    };

    const handleStorage = (e) => {
      if (
        e.key === "customer_theme" ||
        (e.key && e.key.startsWith("customer_settings_"))
      ) {
        setCurrentTheme(getCustomerTheme(user));
      }
    };

    window.addEventListener("customer_theme_change", handleThemeChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("customer_theme_change", handleThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [user]);

  const isDarkMode = currentTheme === "dark";

  return (
    <div
      data-customer-theme={currentTheme}
      className={`flex h-screen overflow-hidden transition-colors duration-200 ${
        isDarkMode
          ? "dark bg-slate-950 text-slate-100"
          : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        {/* Navbar */}
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          isDarkMode={isDarkMode}
        />

        {/* Page Content */}
        <main
          className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto transition-colors duration-200 ${
            isDarkMode
              ? "bg-slate-900 text-slate-100"
              : "bg-gray-100 text-gray-900"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
