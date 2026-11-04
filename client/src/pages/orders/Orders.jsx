/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import api from "../../services/api";

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/order");
      if (res.data?.success && Array.isArray(res.data.orders)) {
        setOrders(res.data.orders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error("Fetch orders error:", err);
      setError(err?.data?.message || err?.message || "Failed to load orders from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        !searchTerm ||
        (order.orderId && order.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.service && order.service.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.link && order.link.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order._id && order._id.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (order.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const getStatusColor = (status) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("complete") || s === "success") return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (s.includes("process")) return "text-blue-600 bg-blue-50 border-blue-200";
    if (s.includes("pending") || s.includes("queue")) return "text-amber-600 bg-amber-50 border-amber-200";
    if (s.includes("cancel") || s.includes("fail")) return "text-rose-600 bg-rose-50 border-rose-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  return (
    <DashboardLayout>
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Orders
        </h1>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline"
        >
          {loading ? "Refreshing..." : "Refresh Orders"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-5 sm:mb-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, Service, or Link..."
            className="flex-1 border rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        {error && (
          <div className="p-3 rounded-lg mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            Loading your orders from server...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className="font-semibold text-base">No orders found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchTerm || statusFilter !== "all"
                ? "Try clearing your search query or status filter."
                : "You have not placed any orders yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="text-left py-3 px-3">Order ID</th>
                  <th className="text-left py-3 px-3">Service</th>
                  <th className="text-left py-3 px-3">Link</th>
                  <th className="text-left py-3 px-3">Quantity</th>
                  <th className="text-left py-3 px-3">Charge</th>
                  <th className="text-left py-3 px-3">Status</th>
                  <th className="text-left py-3 px-3">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const displayId = order.orderId || `#${(order._id || "").slice(-6).toUpperCase()}`;
                  const dateStr = order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={order._id || order.orderId} className="hover:bg-gray-50 transition">
                      <td className="py-3 px-3 font-semibold text-blue-600">
                        {displayId}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-800 max-w-[200px] truncate" title={order.service}>
                        {order.service || "General Service"}
                      </td>
                      <td className="py-3 px-3 max-w-[150px] truncate text-gray-500" title={order.link}>
                        <a href={order.link} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500">
                          {order.link || "—"}
                        </a>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {Number(order.quantity || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        ₹{Number(order.charge || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                          {order.status || "Processing"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs">
                        {dateStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile hint */}
        <p className="text-xs text-gray-400 mt-4 md:hidden">
          Swipe left to see full order details →
        </p>

      </div>
    </DashboardLayout>
  );
}

export default Orders;
