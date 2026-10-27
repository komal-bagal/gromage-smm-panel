import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaBars,
  FaBell,
  FaUserShield,
  FaSignOutAlt,
  FaExternalLinkAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaSun,
  FaMoon,
  FaDesktop,
} from "react-icons/fa";

function AdminNavbar({ onMenuClick, currentTheme = "light", isDarkMode = false }) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const notifRef = useRef(null);
  const userRef = useRef(null);

  const notifications = [
    { id: 1, title: "Order #9821 refill requested", time: "5 min ago", type: "warning" },
    { id: 2, title: "UPI payment #UTR-9081231 needs review", time: "25 min ago", type: "info" },
    { id: 3, title: "Provider 'SMM Kings' balance below $500", time: "1 hr ago", type: "warning" },
    { id: 4, title: "Cron service sync completed (18 services)", time: "2 hrs ago", type: "success" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    navigate("/admin/login");
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className={`h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs border-b transition-colors duration-200 ${
        isDarkMode
          ? "bg-slate-900 border-slate-800 text-slate-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      {/* Left: Mobile Toggle & System Label */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className={`lg:hidden p-2 rounded-lg transition ${
            isDarkMode
              ? "text-slate-400 hover:text-white hover:bg-slate-800"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
          aria-label="Toggle menu"
        >
          <FaBars className="text-lg" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isDarkMode
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/80"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Backend REST Connected
          </span>
        </div>
      </div>

      {/* Right: Quick actions, Theme & Profile */}
      <div className="flex items-center gap-3">
        {/* Quick Theme Setting Indicator */}
        <Link
          to="/admin/system-settings"
          title={`Active Theme: ${
            currentTheme === "dark"
              ? "Dark Mode"
              : currentTheme === "system"
              ? "System Sync"
              : "Light Mode"
          } (Click to configure)`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
            isDarkMode
              ? "text-amber-300 bg-slate-800/80 border-slate-700 hover:bg-slate-700/80"
              : "text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:text-blue-600"
          }`}
        >
          {currentTheme === "dark" ? (
            <FaMoon className="text-xs text-indigo-400" />
          ) : currentTheme === "system" ? (
            <FaDesktop className="text-xs text-purple-400" />
          ) : (
            <FaSun className="text-xs text-amber-500" />
          )}
          <span className="hidden md:inline capitalize text-[11px]">
            {currentTheme === "system" ? "System Auto" : currentTheme}
          </span>
        </Link>

        {/* User Panel Link */}
        <Link
          to="/dashboard"
          className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
            isDarkMode
              ? "text-slate-300 hover:text-blue-400 hover:bg-slate-800 border-slate-700"
              : "text-gray-700 hover:text-blue-600 hover:bg-gray-50 border-gray-200"
          }`}
        >
          <span>User Panel</span>
          <FaExternalLinkAlt className="text-[10px]" />
        </Link>

        {/* Notifications Dropdown */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-lg transition ${
              isDarkMode
                ? "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
                : "text-gray-600 hover:text-blue-600 hover:bg-gray-100"
            }`}
            aria-label="View notifications"
          >
            <FaBell className="text-lg" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div
              className={`absolute right-0 mt-2 w-80 rounded-xl shadow-xl border py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800 text-slate-100 shadow-2xl"
                  : "bg-white border-gray-100 text-gray-900 shadow-xl"
              }`}
            >
              <div
                className={`px-4 py-2 border-b flex items-center justify-between ${
                  isDarkMode ? "border-slate-800" : "border-gray-100"
                }`}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Admin Alerts
                </h4>
                <span className="text-[10px] text-blue-500 font-semibold cursor-pointer hover:underline">
                  Mark all read
                </span>
              </div>

              <div
                className={`divide-y max-h-72 overflow-y-auto ${
                  isDarkMode ? "divide-slate-800" : "divide-gray-100"
                }`}
              >
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 flex items-start gap-2.5 transition ${
                      isDarkMode ? "hover:bg-slate-800/60" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {n.type === "success" ? (
                        <FaCheckCircle className="text-emerald-500 text-xs" />
                      ) : (
                        <FaExclamationCircle className="text-amber-500 text-xs" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium leading-snug ${
                          isDarkMode ? "text-slate-200" : "text-gray-800"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400">{n.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`p-2 border-t text-center ${
                  isDarkMode ? "border-slate-800" : "border-gray-100"
                }`}
              >
                <Link
                  to="/admin/audit-logs"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-blue-500 font-medium hover:underline"
                >
                  View All Activity Logs →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Admin Profile Dropdown */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={`flex items-center gap-2.5 p-1 rounded-lg transition cursor-pointer ${
              isDarkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              AP
            </div>
            <div className="hidden sm:block text-left">
              <p
                className={`text-xs font-bold leading-tight ${
                  isDarkMode ? "text-slate-100" : "text-gray-800"
                }`}
              >
                Amruta Patil
              </p>
              <p className="text-[10px] text-gray-400 font-medium">Administrator</p>
            </div>
          </button>

          {showUserDropdown && (
            <div
              className={`absolute right-0 mt-2 w-56 rounded-xl shadow-xl border py-1.5 z-50 ${
                isDarkMode
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-gray-100 text-gray-900"
              }`}
            >
              <div
                className={`px-4 py-2 border-b ${
                  isDarkMode ? "border-slate-800" : "border-gray-100"
                }`}
              >
                <p className="text-xs font-semibold">Signed in as Admin</p>
                <p className="text-[11px] text-gray-400 truncate">amruta.patil@gromage.com</p>
              </div>

              <Link
                to="/admin/system-settings"
                onClick={() => setShowUserDropdown(false)}
                className={`flex items-center gap-2 px-4 py-2 text-xs transition ${
                  isDarkMode
                    ? "text-slate-300 hover:bg-slate-800"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FaUserShield className="text-gray-400" />
                <span>System & Theme Settings</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-500/10 transition text-left"
              >
                <FaSignOutAlt />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AdminNavbar;
