import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

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

import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
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

      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;