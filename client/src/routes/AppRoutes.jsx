import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// User Auth Pages
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

// User Protected Pages
import Dashboard from "../pages/dashboard/Dashboard";
import Orders from "../pages/orders/Orders";
import Services from "../pages/services/Services";
import Wallet from "../pages/wallet/Wallet";
import Profile from "../pages/profile/Profile";
import Settings from "../pages/settings/Settings";
import NewOrder from "../pages/neworder/NewOrder";
import Tickets from "../pages/tickets/Tickets";
import API from "../pages/api/API";
import MassOrder from "../pages/massOrder/MassOrder";
import Refunds from "../pages/refunds/Refunds";
import Updates from "../pages/updates/Updates";
import AddFunds from "../pages/wallet/AddFunds";

// Admin Pages
import AdminLogin from "../pages/admin/AdminLogin";
import AdminDashboard from "../pages/admin/Dashboard/AdminDashboard";
import AdminUsers from "../pages/admin/Users/AdminUsers";
import AdminCategories from "../pages/admin/Categories/AdminCategories";
import AdminServices from "../pages/admin/Services/AdminServices";
import AdminProviders from "../pages/admin/Providers/AdminProviders";
import AdminOrders from "../pages/admin/Orders/AdminOrders";
import AdminFinance from "../pages/admin/Finance/AdminFinance";
import AdminQrPayments from "../pages/admin/QrPayments/AdminQrPayments";
import AdminCoupons from "../pages/admin/Coupons/AdminCoupons";
import AdminAffiliate from "../pages/admin/Affiliate/AdminAffiliate";
import AdminTickets from "../pages/admin/Tickets/AdminTickets";
import AdminInvoices from "../pages/admin/Invoices/AdminInvoices";
import AdminNotifications from "../pages/admin/Notifications/AdminNotifications";
import AdminReports from "../pages/admin/Reports/AdminReports";
import AdminCmsPages from "../pages/admin/Cms/AdminCmsPages";
import AdminWebsiteSettings from "../pages/admin/Settings/AdminWebsiteSettings";
import AdminSeoSettings from "../pages/admin/Settings/AdminSeoSettings";
import AdminPaymentSettings from "../pages/admin/Settings/AdminPaymentSettings";
import AdminSystemSettings from "../pages/admin/Settings/AdminSystemSettings";
import AdminRoles from "../pages/admin/Roles/AdminRoles";
import AdminAuditLogs from "../pages/admin/AuditLogs/AdminAuditLogs";

// Route Guards
import ProtectedRoute from "./ProtectedRoute";
import AdminProtectedRoute from "./AdminProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* User Panel Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/services" element={<Services />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/new-order" element={<NewOrder />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/api" element={<API />} />
          <Route path="/mass-order" element={<MassOrder />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/add-funds" element={<AddFunds />} />
        </Route>

        {/* Admin Login Route */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin-login" element={<Navigate to="/admin/login" replace />} />

        {/* Admin CMS Protected Routes */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/providers" element={<AdminProviders />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/wallet" element={<AdminFinance />} />
          <Route path="/admin/transactions" element={<AdminFinance />} />
          <Route path="/admin/qr-payments" element={<AdminQrPayments />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/affiliate" element={<AdminAffiliate />} />
          <Route path="/admin/tickets" element={<AdminTickets />} />
          <Route path="/admin/invoices" element={<AdminInvoices />} />
          <Route path="/admin/notifications" element={<AdminNotifications />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/cms" element={<AdminCmsPages />} />
          <Route path="/admin/settings" element={<AdminWebsiteSettings />} />
          <Route path="/admin/seo" element={<AdminSeoSettings />} />
          <Route path="/admin/payment-settings" element={<AdminPaymentSettings />} />
          <Route path="/admin/system-settings" element={<AdminSystemSettings />} />
          <Route path="/admin/roles" element={<AdminRoles />} />
          <Route path="/admin/permissions" element={<AdminRoles />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;