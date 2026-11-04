import {
  FaBell,
  FaUserCircle,
  FaSignOutAlt,
  FaBars,
} from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function Navbar({ onMenuClick, isDarkMode = false }) {
  const navigate = useNavigate();
  const { user: authUser, logout, updateUser } = useAuth();
  const [profile, setProfile] = useState(authUser || null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [showCurrency, setShowCurrency] = useState(false);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const currencyRef = useRef(null);

  useEffect(() => {
    if (authUser) {
      setProfile(authUser);
    }
  }, [authUser]);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await api.get("/api/user/profile");
        if (res.data?.success && res.data?.user && isMounted) {
          const fetchedUser = res.data.user;
          const authId = authUser?._id || authUser?.id;
          const fetchedId = fetchedUser?._id || fetchedUser?.id;

          // Ensure profile data belongs strictly to the currently authenticated session
          if (!authId || !fetchedId || authId === fetchedId || authUser?.email === fetchedUser?.email) {
            setProfile(fetchedUser);
            if (updateUser) {
              updateUser(fetchedUser);
            }
          }
        }
      } catch {
        // Fall back gracefully to authUser
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser?.id, authUser?._id, authUser?.email, updateUser]);

  const activeUser = profile || authUser;
  const inrBalance = Number(activeUser?.balance || 0);

  const balances = {
    INR: `₹${inrBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    USD: `$${(inrBalance / 85).toFixed(2)}`,
    EUR: `€${(inrBalance / 92).toFixed(2)}`,
    GBP: `£${(inrBalance / 108).toFixed(2)}`,
  };

  const handleLogout = () => {
    if (logout) {
      logout();
    } else {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("admin_token");
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("admin_token");
        localStorage.removeItem("user");
      }
    }
    navigate("/login");
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }

      if (
        currencyRef.current &&
        !currencyRef.current.contains(event.target)
      ) {
        setShowCurrency(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header
      className={`h-16 shadow flex items-center justify-between px-3 sm:px-6 transition-colors duration-200 ${
        isDarkMode
          ? "bg-slate-900 border-b border-slate-800 text-slate-100"
          : "bg-white text-gray-800"
      }`}
    >
      {/* Left Side */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className={`md:hidden text-xl transition flex-shrink-0 cursor-pointer ${
            isDarkMode ? "text-slate-300 hover:text-blue-400" : "text-gray-700 hover:text-blue-600"
          }`}
          aria-label="Open menu"
        >
          <FaBars />
        </button>

        <div className="min-w-0">
          <h2
            className={`text-base sm:text-xl font-bold truncate ${
              isDarkMode ? "text-slate-100" : "text-gray-800"
            }`}
          >
            Welcome Back 👋
          </h2>

          <p
            className={`text-xs sm:text-sm truncate ${
              isDarkMode ? "text-slate-400" : "text-gray-500"
            }`}
          >
            Have a great day, {activeUser?.name || "Customer"}
          </p>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Notification */}
        <div ref={notificationRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative text-xl sm:text-2xl transition cursor-pointer ${
              isDarkMode ? "text-slate-300 hover:text-blue-400" : "text-gray-600 hover:text-blue-600"
            }`}
          >
            <FaBell />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
          </button>

          {showNotifications && (
            <div
              className={`absolute right-0 mt-3 w-72 sm:w-80 rounded-xl shadow-xl border z-50 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-100 shadow-2xl"
                  : "bg-white border-gray-100 text-gray-900 shadow-xl"
              }`}
            >
              <div
                className={`p-4 border-b ${
                  isDarkMode ? "border-slate-700" : "border-gray-100"
                }`}
              >
                <h3 className="font-semibold text-sm">Notifications</h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <p className="font-medium text-sm">Account Status: Active</p>
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Connected to SMM Panel
                  </span>
                </div>

                <div>
                  <p className="font-medium text-sm">💰 Balance: {balances.INR}</p>
                  <span
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Available for orders
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowNotifications(false);
                  navigate("/updates");
                }}
                className={`w-full border-t py-3 text-sm text-blue-500 hover:underline font-medium cursor-pointer ${
                  isDarkMode ? "border-slate-700 hover:bg-slate-750" : "hover:bg-gray-50"
                }`}
              >
                View Updates & Announcements
              </button>
            </div>
          )}
        </div>

        {/* Currency - Hidden on very small screens */}
        <div ref={currencyRef} className="relative hidden sm:block">
          <button
            onClick={() => setShowCurrency(!showCurrency)}
            className={`px-3 sm:px-4 py-2 border rounded-lg transition font-medium text-sm cursor-pointer ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700"
                : "bg-white border-gray-200 text-gray-800 hover:bg-gray-100"
            }`}
          >
            {balances[currency] || balances.INR} ▼
          </button>

          {showCurrency && (
            <div
              className={`absolute right-0 mt-2 w-40 rounded-xl shadow-lg border z-50 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-100 shadow-2xl"
                  : "bg-white border-gray-100 text-gray-900 shadow-lg"
              }`}
            >
              {[
                ["INR", "🇮🇳 INR ₹"],
                ["USD", "🇺🇸 USD $"],
                ["EUR", "🇪🇺 EUR €"],
                ["GBP", "🇬🇧 GBP £"],
              ].map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => {
                    setCurrency(code);
                    setShowCurrency(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm cursor-pointer transition ${
                    isDarkMode
                      ? "hover:bg-slate-700 text-slate-100"
                      : "hover:bg-gray-100 text-gray-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profile */}
        <div
          ref={profileRef}
          onClick={() => navigate("/profile")}
          className={`flex items-center cursor-pointer px-1 sm:px-3 py-2 rounded-lg transition ${
            isDarkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"
          }`}
        >
          <FaUserCircle
            className={`text-2xl sm:text-3xl ${
              isDarkMode ? "text-slate-300" : "text-gray-700"
            }`}
          />

          <div className="hidden lg:block ml-2 text-left">
            <p
              className={`font-semibold text-sm leading-tight truncate max-w-[120px] ${
                isDarkMode ? "text-slate-100" : "text-gray-800"
              }`}
            >
              {activeUser?.name || "Account"}
            </p>
            <p
              className={`text-[11px] truncate max-w-[120px] ${
                isDarkMode ? "text-slate-400" : "text-gray-500"
              }`}
            >
              {activeUser?.email || "Customer"}
            </p>
          </div>
        </div>

        {/* Logout - Hidden on small mobile */}
        <button
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 ml-1 cursor-pointer"
        >
          <FaSignOutAlt className="text-lg" />
          Logout
        </button>
      </div>
    </header>
  );
}

export default Navbar;
