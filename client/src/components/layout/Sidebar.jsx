import {
  FaShoppingCart,
  FaServicestack,
  FaWallet,
  FaUser,
  FaCog,
  FaSignOutAlt,
  FaPlusCircle,
  FaTicketAlt,
  FaCode,
  FaLayerGroup,
  FaUndoAlt,
  FaBullhorn,
  FaTimes,
} from "react-icons/fa";

import { NavLink, useNavigate } from "react-router-dom";

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
    onClose();
  };

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50
          w-64 h-screen
          bg-slate-900 text-white
          flex flex-col
          transform transition-transform duration-300 ease-in-out

          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >

        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">
              GROMAGE
            </h1>

            <p className="text-sm text-gray-400">
              SMM Panel
            </p>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white text-xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto hide-scrollbar p-4">
          <div className="space-y-2">

            <NavLink
              to="/new-order"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaPlusCircle />
              New Order
            </NavLink>

            <NavLink
              to="/orders"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaShoppingCart />
              Orders
            </NavLink>

            <NavLink
              to="/services"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaServicestack />
              Services
            </NavLink>

            <NavLink
              to="/wallet"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaWallet />
              Wallet
            </NavLink>

            <NavLink
              to="/refunds"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaUndoAlt />
              Refunds
            </NavLink>

            <NavLink
              to="/api"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaCode />
              API
            </NavLink>

            <NavLink
              to="/tickets"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaTicketAlt />
              Tickets
            </NavLink>

            <NavLink
              to="/mass-order"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaLayerGroup />
              Mass Order
            </NavLink>

            <NavLink
              to="/updates"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaBullhorn />
              Updates
            </NavLink>

            <NavLink
              to="/profile"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaUser />
              Profile
            </NavLink>

            <NavLink
              to="/settings"
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 p-3 rounded-lg transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800"
                }`
              }
            >
              <FaCog />
              Settings
            </NavLink>

          </div>
        </nav>

        {/* Logout */}
        <div className="mt-auto p-4 border-t border-slate-700 bg-slate-900">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full bg-red-600 hover:bg-red-700 p-3 rounded-lg transition"
          >
            <FaSignOutAlt />
            Logout
          </button>
        </div>

      </aside>
    </>
  );
}

export default Sidebar;