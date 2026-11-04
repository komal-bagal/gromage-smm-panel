import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import api from "../../services/api";

function AddFunds() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handlePayment = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isSubmitting) return;

    setStatusMessage(null);
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      setStatusMessage({ type: "error", text: "Please enter a valid amount greater than ₹0." });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post("/api/wallet/recharge", {
        amount: numAmount,
        paymentMethod,
        reference: reference.trim() || undefined,
      });

      const data = res.data;
      if (data?.success) {
        setStatusMessage({
          type: "success",
          text: data.message || `Payment request for ₹${numAmount} submitted successfully! Your balance will update once approved by admin.`,
        });
        setAmount("");
        setReference("");
      } else {
        setStatusMessage({
          type: "error",
          text: data?.message || "Failed to process recharge request.",
        });
      }
    } catch (err) {
      console.error("Add funds error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error ||
        err?.response?.data?.error;

      setStatusMessage({
        type: "error",
        text: backendMessage || "Failed to submit recharge request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/wallet")}
          className="text-gray-600 hover:text-blue-600 text-lg cursor-pointer"
        >
          ← Back to Wallet
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Add Funds
        </h1>
      </div>

      <div className="max-w-2xl bg-white rounded-xl shadow p-5 sm:p-8">

        {statusMessage && (
          <div
            className={`p-4 rounded-lg mb-6 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handlePayment}>
          {/* Amount */}
          <div className="mb-6">
            <label className="block font-medium text-gray-700 mb-2 text-sm">
              Enter Amount
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                ₹
              </span>

              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                min="10"
                required
                className="w-full border rounded-lg py-3 pl-8 pr-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mb-6">
            <p className="font-medium text-gray-700 mb-3 text-sm">
              Quick Select
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[100, 500, 1000, 5000].map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setAmount(value.toString())}
                  className="border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 rounded-lg font-medium transition cursor-pointer text-sm"
                >
                  ₹{value}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <label className="block font-medium text-gray-700 mb-2 text-sm">
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-medium cursor-pointer"
            >
              <option value="UPI">UPI (Instant Verification)</option>
              <option value="QR Code">QR Code Payment</option>
              <option value="Card">Credit / Debit Card</option>
              <option value="Net Banking">Net Banking</option>
            </select>
          </div>

          {/* Transaction / Reference ID */}
          <div className="mb-6">
            <label className="block font-medium text-gray-700 mb-2 text-sm">
              Payment Reference / UTR Number <span className="text-gray-400 font-normal">(Optional)</span>
            </label>

            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UPI Ref / UTR / Order ID"
              className="w-full border rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
            <h3 className="font-semibold text-gray-800 mb-2">
              Payment Summary
            </h3>
            <div className="flex justify-between py-1 text-gray-600">
              <span>Deposit Amount</span>
              <span className="font-semibold text-gray-800">₹{Number(amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 text-gray-600">
              <span>Gateway Fee</span>
              <span>₹0.00</span>
            </div>
            <div className="border-t my-2 pt-2 flex justify-between font-bold text-gray-900">
              <span>Total Payable</span>
              <span className="text-blue-600">₹{Number(amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !amount || Number(amount) <= 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting Request..." : `Proceed to Deposit ₹${Number(amount || 0).toFixed(2)}`}
          </button>
        </form>

      </div>
    </DashboardLayout>
  );
}

export default AddFunds;
