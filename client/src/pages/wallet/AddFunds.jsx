import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";

function AddFunds() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");

  const handlePayment = () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    alert(
      `Proceeding to payment of ₹${amount} using ${paymentMethod}`
    );
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/wallet")}
          className="text-gray-600 hover:text-blue-600 text-lg"
        >
          ← Back
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Add Funds
        </h1>
      </div>

      <div className="max-w-2xl bg-white rounded-xl shadow p-5 sm:p-8">
        {/* Amount */}
        <div className="mb-6">
          <label className="block font-medium text-gray-700 mb-2">
            Enter Amount
          </label>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
              ₹
            </span>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
              className="w-full border rounded-lg py-3 pl-8 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="mb-6">
          <p className="font-medium text-gray-700 mb-3">
            Quick Select
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[100, 500, 1000, 5000].map((value) => (
              <button
                key={value}
                onClick={() => setAmount(value)}
                className="border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition"
              >
                ₹{value}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div className="mb-6">
          <label className="block font-medium text-gray-700 mb-2">
            Payment Method
          </label>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border rounded-lg p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="UPI">UPI</option>
            <option value="Card">Credit / Debit Card</option>
            <option value="Net Banking">Net Banking</option>
          </select>
        </div>

        {/* Payment Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">
            Payment Summary
          </h3>

          <div className="flex justify-between text-gray-600">
            <span>Amount</span>
            <span>₹{amount || "0"}</span>
          </div>

          <div className="border-t mt-3 pt-3 flex justify-between font-bold text-gray-800">
            <span>Total</span>
            <span>₹{amount || "0"}</span>
          </div>
        </div>

        {/* Payment Button */}
        <button
          onClick={handlePayment}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
        >
          Proceed to Payment
        </button>
      </div>
    </DashboardLayout>
  );
}

export default AddFunds;