import { NavLink, useNavigate } from "react-router-dom";
import {
  FaTachometerAlt,
  FaUsers,
  FaTags,
  FaListUl,
  FaServer,
  FaShoppingCart,
  FaMoneyBillWave,
  FaQrcode,
  FaTicketAlt,
  FaFileInvoiceDollar,
  FaBullhorn,
  FaChartBar,
  FaFileAlt,
  FaSlidersH,
  FaGlobe,
  FaCreditCard,
  FaUserShield,
  FaHistory,
  FaSignOutAlt,
  FaExternalLinkAlt,
  FaTimes,
  FaPercent,
  FaHandshake,
  FaTools,
} from "react-icons/fa";

const navSections = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", path: "/admin/dashboard", icon: <FaTachometerAlt /> },
      { name: "Users", path: "/admin/users", icon: <FaUsers /> },
    ],
  },
  {
    title: "CATALOG & PROVIDERS",
    items: [
      { name: "Categories", path: "/admin/categories", icon: <FaTags /> },
      { name: "Services", path: "/admin/services", icon: <FaListUl /> },
      { name: "Providers", path: "/admin/providers", icon: <FaServer /> },
    ],
  },
  {
    title: "ORDERS",
    items: [
      { name: "All Orders", path: "/admin/orders", icon: <FaShoppingCart /> },
    ],
  },
  {
    title: "FINANCE & GROWTH",
    items: [
      { name: "Transactions", path: "/admin/transactions", icon: <FaMoneyBillWave /> },
      { name: "QR Payments CMS", path: "/admin/qr-payments", icon: <FaQrcode /> },
      { name: "Coupons", path: "/admin/coupons", icon: <FaPercent /> },
      { name: "Affiliate", path: "/admin/affiliate", icon: <FaHandshake /> },
      { name: "GST Invoices", path: "/admin/invoices", icon: <FaFileInvoiceDollar /> },
    ],
  },
  {
    title: "SUPPORT & COMMS",
    items: [
      { name: "Tickets", path: "/admin/tickets", icon: <FaTicketAlt />, badge: "3" },
      { name: "Announcements", path: "/admin/notifications", icon: <FaBullhorn /> },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { name: "Reports & Analytics", path: "/admin/reports", icon: <FaChartBar /> },
    ],
  },
  {
    title: "CMS & CONFIGURATION",
    items: [
      { name: "CMS Pages", path: "/admin/cms", icon: <FaFileAlt /> },
      { name: "Website Settings", path: "/admin/settings", icon: <FaSlidersH /> },
      { name: "SEO Settings", path: "/admin/seo", icon: <FaGlobe /> },
      { name: "Payment Settings", path: "/admin/payment-settings", icon: <FaCreditCard /> },
      { name: "System Settings", path: "/admin/system-settings", icon: <FaTools /> },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { name: "Roles & Permissions", path: "/admin/roles", icon: <FaUserShield /> },
      { name: "Audit Logs", path: "/admin/audit-logs", icon: <FaHistory /> },
    ],
  },
];

function AdminSidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("token");
    navigate("/admin/login");
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50
          w-64 h-screen
          bg-slate-950 text-slate-200
          border-r border-slate-800
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
              G
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                GROMAGE
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Admin CMS
                </span>
              </h1>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Close sidebar"
          >
            <FaTimes />
          </button>
        </div>

        {/* User Panel Quick Switch */}
        <div className="p-3 bg-slate-900/60 border-b border-slate-800/80">
          <NavLink
            to="/dashboard"
            className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition border border-slate-700/60"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Switch to User Panel
            </span>
            <FaExternalLinkAlt className="text-[10px] text-slate-400" />
          </NavLink>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 hide-scrollbar">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold shadow-sm"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-sm shrink-0 opacity-80">
                        {item.icon}
                      </span>
                      <span>{item.name}</span>
                    </span>

                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer / User & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
              AD
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                Amruta Patil
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                Super Administrator
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-900 transition"
          >
            <FaSignOutAlt className="text-sm" />
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;
