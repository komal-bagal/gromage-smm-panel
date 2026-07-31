import { FaBell, FaUserCircle } from "react-icons/fa";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaSignOutAlt } from "react-icons/fa";

function Navbar() {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [showCurrency, setShowCurrency] = useState(false);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const currencyRef = useRef(null);

  const balances = {
    INR: "₹12,500",
    USD: "$150.25",
    EUR: "€135.40",
    GBP: "£118.75",
  };

  const handleLogout = () => {

    localStorage.removeItem("token");

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
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setShowProfile(false);
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
    <header className="bg-white h-16 shadow flex items-center justify-between px-6">

      {/* Left Side */}
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          Welcome Back 👋
        </h2>

        <p className="text-sm text-gray-500">
          Have a great day, Admin
        </p>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">

        {/* Notification */}
        <div ref={notificationRef} className="relative">

          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-2xl text-gray-600 hover:text-blue-600 transition"
          >
            <FaBell />

            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>

          </button>

          {showNotifications && (

            <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-xl border z-50">

              <div className="p-4 border-b">
                <h3 className="font-semibold">
                  Notifications
                </h3>
              </div>

              <div className="p-4 space-y-4">

                <div>
                  <p className="font-medium">
                    ✅ Order #245 Completed
                  </p>

                  <span className="text-sm text-gray-500">
                    2 min ago
                  </span>
                </div>

                <div>
                  <p className="font-medium">
                    💰 ₹500 Added to Wallet
                  </p>

                  <span className="text-sm text-gray-500">
                    15 min ago
                  </span>
                </div>

                <div>
                  <p className="font-medium">
                    🎫 Ticket Replied
                  </p>

                  <span className="text-sm text-gray-500">
                    1 hour ago
                  </span>
                </div>

              </div>

              <button className="w-full border-t py-3 text-blue-600 hover:bg-gray-50">
                View All Notifications
              </button>

            </div>

          )}

        </div>

        {/* Currency */}
        <div ref={currencyRef} className="relative">

          <button
            onClick={() => setShowCurrency(!showCurrency)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition font-medium"
          >
            {balances[currency]} ▼
          </button>

          {showCurrency && (

            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border z-50">

              <button
                onClick={() => {
                  setCurrency("INR");
                  setShowCurrency(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-100"
              >
                🇮🇳 INR ₹
              </button>

              <button
                onClick={() => {
                  setCurrency("USD");
                  setShowCurrency(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-100"
              >
                🇺🇸 USD $
              </button>

              <button
                onClick={() => {
                  setCurrency("EUR");
                  setShowCurrency(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-100"
              >
                🇪🇺 EUR €
              </button>

              <button
                onClick={() => {
                  setCurrency("GBP");
                  setShowCurrency(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-100"
              >
                🇬🇧 GBP £
              </button>

            </div>

          )}

        </div>

        {/* Profile */}
        <div
          ref={profileRef}
          onClick={() => navigate("/profile")}
          className="relative flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-3 py-2 rounded-lg transition"
        >

          <FaUserCircle className="text-3xl text-gray-700" />

          <div className="hidden md:block">
            <p className="font-semibold text-sm">
              Account
            </p>
          </div>

        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700"
        >
           <FaSignOutAlt className="text-lg" />
          Logout
        </button>

      </div>

    </header>
  );
}

export default Navbar;