/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import api from "../../services/api";

function Refunds() {
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [refundedOrders, setRefundedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchRefundHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/order");
      if (res.data?.success && Array.isArray(res.data.orders)) {
        const canceled = res.data.orders.filter(
          (o) =>
            (o.status || "").toLowerCase().includes("cancel") ||
            (o.status || "").toLowerCase().includes("refund")
        );
        setRefundedOrders(canceled);
      } else {
        setRefundedOrders([]);
      }
    } catch (err) {
      console.error("Fetch refund history error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRefundHistory();
  }, [fetchRefundHistory]);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isSubmitting) return;

    setStatusMessage(null);

    const cleanOrderId = orderId.trim();
    const cleanReason = reason.trim();

    if (!cleanOrderId) {
      setStatusMessage({ type: "error", text: "Please provide a valid Order ID." });
      return;
    }

    if (!cleanReason) {
      setStatusMessage({ type: "error", text: "Please explain the reason for the refund request." });
      return;
    }

    setIsSubmitting(true);

    try {
      // Connect to support ticket backend under Billing department
      const res = await api.post("/api/ticket", {
        subject: `Refund Request: Order #${cleanOrderId}`,
        department: "Billing",
        priority: "High",
        message: `Order ID: ${cleanOrderId}\nReason for Refund: ${cleanReason}`,
      });

      if (res.data?.success) {
        setStatusMessage({
          type: "success",
          text: `Refund ticket #${res.data.ticket?.ticketId || res.data.ticket?.id || "Created"} submitted! Our billing team will inspect and process it shortly.`,
        });
        setOrderId("");
        setReason("");
      } else {
        setStatusMessage({
          type: "error",
          text: res.data?.message || "Failed to submit refund ticket.",
        });
      }
    } catch (err) {
      console.error("Submit refund request error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error;

      setStatusMessage({
        type: "error",
        text: backendMessage || "Unable to submit refund request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Refund Requests
      </h1>

      {/* Refund Form */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-5 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">
          Request Refund
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Submit a refund request for an incomplete or failed order. Our staff will review your case.
        </p>

        {statusMessage && (
          <div
            className={`p-3.5 rounded-lg mb-5 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-medium text-sm text-gray-700">
              Order ID
            </label>

            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-08044977"
              required
              className="w-full border rounded-lg p-2.5 sm:p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-sm text-gray-700">
              Reason for Refund
            </label>

            <textarea
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue with this order (e.g. Order not delivered, wrong link, duplicate charge)..."
              required
              className="w-full border rounded-lg p-2.5 sm:p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? "Submitting Request..." : "Submit Refund Request"}
          </button>
        </form>
      </div>

      {/* Refund History */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
            Canceled & Refunded Orders
          </h2>
          <button
            onClick={fetchRefundHistory}
            disabled={loading}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            Loading refund records...
          </div>
        ) : refundedOrders.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <p className="font-semibold text-sm">No refunded orders found</p>
            <p className="text-xs text-gray-400 mt-1">
              Any canceled orders or processed refunds will be listed here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="p-3 text-left">Order ID</th>
                  <th className="p-3 text-left">Service</th>
                  <th className="p-3 text-left">Amount Refunded</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {refundedOrders.map((order) => {
                  const dateStr = order.updatedAt
                    ? new Date(order.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={order._id || order.orderId} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-blue-600">
                        {order.orderId || `#${(order._id || "").slice(-6).toUpperCase()}`}
                      </td>
                      <td className="p-3 font-medium text-gray-800 max-w-xs truncate">
                        {order.service || "General Service"}
                      </td>
                      <td className="p-3 font-semibold text-emerald-600">
                        ₹{Number(order.charge || 0).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          {order.status || "Canceled"}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

export default Refunds;
