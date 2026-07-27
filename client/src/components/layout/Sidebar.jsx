import {
  FaTachometerAlt,
  FaShoppingCart,
  FaServicestack,
  FaWallet,
  FaUser,
  FaCog,
  FaSignOutAlt,
} from "react-icons/fa";

import { NavLink } from "react-router-dom";
import { FaPlusCircle } from "react-icons/fa";
import { FaTicketAlt } from "react-icons/fa";
import { FaCode } from "react-icons/fa";
import { FaLayerGroup } from "react-icons/fa";
import { FaUndoAlt } from "react-icons/fa";
import { FaBullhorn } from "react-icons/fa";

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-slate-900 text-white flex flex-col">

      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-blue-400">GROMAGE</h1>
        <p className="text-sm text-gray-400">SMM Panel</p>
      </div>

      <nav className="flex-1 overflow-y-auto hide-scrollbar p-4">
        <div className="space-y-2">

          <NavLink
            to="/dashboard"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaTachometerAlt />
            Dashboard
          </NavLink>

          <NavLink
            to="/orders"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaShoppingCart />
            Orders
          </NavLink>

          <NavLink
            to="/new-order"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaPlusCircle />
            New Order
          </NavLink>

          <NavLink
            to="/services"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaServicestack />
            Services
          </NavLink>

          <NavLink
            to="/wallet"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaWallet />
            Wallet
          </NavLink>

          <NavLink
            to="/refunds"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaUndoAlt />
            Refunds
          </NavLink>

          <NavLink
            to="/api"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaCode />
            API
          </NavLink>

          <NavLink
            to="/tickets"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaTicketAlt />
            Tickets
          </NavLink>

          <NavLink
            to="/mass-order"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaLayerGroup />
            Mass Order
          </NavLink>

          <NavLink
            to="/updates"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaBullhorn />
            Updates
          </NavLink>

          <NavLink
            to="/profile"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaUser />
            Profile
          </NavLink>

          <NavLink
            to="/settings"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800"
          >
            <FaCog />
            Settings
          </NavLink>
        </div>
      </nav>


      <div className="mt-auto p-4 border-t border-slate-700 bg-slate-900">
        <button className="flex items-center gap-3 w-full bg-red-600 hover:bg-red-700 p-3 rounded-lg">
          <FaSignOutAlt />
          Logout
        </button>
      </div>

    </aside >
  );
}

export default Sidebar;