import { Link, useLocation } from "react-router-dom";
import { FaChevronRight, FaHome } from "react-icons/fa";

const routeNameMap = {
  admin: "Admin",
  dashboard: "Dashboard",
  users: "User Management",
  categories: "Categories",
  services: "Services",
  providers: "Providers",
  orders: "Orders",
  wallet: "Finance",
  transactions: "Transactions",
  "qr-payments": "QR Payment CMS",
  coupons: "Coupons",
  affiliate: "Affiliate System",
  tickets: "Support Tickets",
  invoices: "GST Invoices",
  notifications: "Announcements",
  reports: "Reports & Analytics",
  cms: "CMS Pages",
  settings: "Website Settings",
  seo: "SEO Settings",
  "payment-settings": "Payment Gateways",
  "system-settings": "System Settings",
  roles: "Roles & Permissions",
  permissions: "Permissions Matrix",
  "audit-logs": "Audit Logs",
};

function Breadcrumb({ isDarkMode = false }) {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  return (
    <nav
      className={`flex items-center text-xs font-medium mb-4 transition-colors ${
        isDarkMode ? "text-slate-400" : "text-gray-500"
      }`}
      aria-label="Breadcrumb"
    >
      <Link
        to="/admin/dashboard"
        className={`flex items-center gap-1.5 transition ${
          isDarkMode
            ? "text-slate-400 hover:text-blue-400"
            : "text-gray-500 hover:text-blue-600"
        }`}
      >
        <FaHome className="text-sm" />
        <span>Admin</span>
      </Link>

      {pathnames.map((value, index) => {
        if (value === "admin") return null;
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNameMap[value] || value.replace(/-/g, " ");

        return (
          <div key={to} className="flex items-center">
            <FaChevronRight
              className={`mx-2 text-[10px] ${
                isDarkMode ? "text-slate-600" : "text-gray-400"
              }`}
            />
            {isLast ? (
              <span
                className={`font-semibold capitalize ${
                  isDarkMode ? "text-slate-200" : "text-gray-800"
                }`}
              >
                {displayName}
              </span>
            ) : (
              <Link
                to={to}
                className={`transition capitalize ${
                  isDarkMode
                    ? "text-slate-400 hover:text-blue-400"
                    : "text-gray-500 hover:text-blue-600"
                }`}
              >
                {displayName}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
