import { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";
import Breadcrumb from "./Breadcrumb";

function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    return (
      (typeof window !== "undefined" && localStorage.getItem("admin_theme")) ||
      "light"
    );
  });
  const [systemIsDark, setSystemIsDark] = useState(() => {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  useEffect(() => {
    const handleThemeChange = (e) => {
      const newTheme =
        e.detail?.theme || localStorage.getItem("admin_theme") || "light";
      setCurrentTheme(newTheme);
    };

    const handleStorage = (e) => {
      if (e.key === "admin_theme") {
        setCurrentTheme(e.newValue || "light");
      }
    };

    const mediaQuery =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const handleMediaChange = (e) => {
      setSystemIsDark(e.matches);
    };

    window.addEventListener("admin_theme_change", handleThemeChange);
    window.addEventListener("storage", handleStorage);
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    }

    return () => {
      window.removeEventListener("admin_theme_change", handleThemeChange);
      window.removeEventListener("storage", handleStorage);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      }
    };
  }, []);

  const isDarkMode =
    currentTheme === "dark" || (currentTheme === "system" && systemIsDark);

  return (
    <div
      data-admin-theme={currentTheme}
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
        isDarkMode
          ? "dark bg-slate-950 text-slate-100"
          : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Admin Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-64">
        {/* Top Navbar */}
        <AdminNavbar
          onMenuClick={() => setSidebarOpen(true)}
          currentTheme={currentTheme}
          isDarkMode={isDarkMode}
        />

        {/* Scrollable Page Body */}
        <main
          className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 transition-colors duration-200 ${
            isDarkMode ? "bg-slate-900 text-slate-100" : "bg-gray-50 text-gray-900"
          }`}
        >
          <div className="max-w-7xl mx-auto">
            <Breadcrumb isDarkMode={isDarkMode} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
