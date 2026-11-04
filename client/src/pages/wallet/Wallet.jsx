/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function Wallet() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [balance, setBalance] = useState(authUser?.balance || 0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWalletData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, txRes] = await Promise.allSettled([
        api.get("/api/user/profile"),
        api.get("/api/payment"),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value.data?.user) {
        setBalance(profileRes.value.data.user.balance || 0);
      }

      if (txRes.status === "fulfilled" && txRes.value.data?.payments) {
        setTransactions(txRes.value.data.payments);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error("Wallet data load error:", err);
      setError("Failed to sync wallet data with server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  return (
    <DashboardLayout>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
            Wallet
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your panel funds and view balance history
          </p>
        </div>

        <button
          onClick={() => navigate("/add-funds")}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold transition cursor-pointer"
        >
          + Add Funds
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-5 sm:p-8 mb-5 sm:mb-8 shadow">
        <p className="text-sm sm:text-base font-medium opacity-90">
          Current Available Balance
        </p>

        <h2 className="text-3xl sm:text-5xl font-bold mt-2">
          ₹{Number(balance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h2>

        <p className="text-xs text-blue-100 mt-3">
          Funds are automatically deducted as you place orders on the panel.
        </p>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
            Recent Transactions
          </h2>

          <button
            onClick={fetchWalletData}
            disabled={loading}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500 text-sm">
            Loading wallet records...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <p className="font-semibold text-base">No transaction history yet</p>
            <p className="text-xs text-gray-400 mt-1">
              When you deposit funds or place orders, your transactions will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="text-left py-3 px-3">Date</th>
                  <th className="text-left py-3 px-3">Payment ID</th>
                  <th className="text-left py-3 px-3">Type</th>
                  <th className="text-left py-3 px-3">Method</th>
                  <th className="text-left py-3 px-3">Amount</th>
                  <th className="text-left py-3 px-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const isCredit = (tx.type || "").toLowerCase() === "credit";
                  const dateStr = tx.createdAt
                    ? new Date(tx.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={tx._id || tx.paymentId} className="hover:bg-gray-50">
                      <td className="py-3 px-3 text-gray-500 text-xs">{dateStr}</td>
                      <td className="px-3 font-medium text-gray-700">{tx.paymentId || "—"}</td>
                      <td className="px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          isCredit ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {tx.type || "Transaction"}
                        </span>
                      </td>
                      <td className="px-3 text-gray-600">{tx.method || "Direct"}</td>
                      <td className={`px-3 font-semibold ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                        {isCredit ? "+" : "-"}₹{Number(tx.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-3">
                        <span className="text-xs capitalize font-medium text-gray-600">
                          {tx.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Scroll Hint */}
        <p className="text-xs text-gray-400 mt-4 md:hidden">
          ← Swipe horizontally to see complete transaction details →
        </p>

      </div>

    </DashboardLayout>
  );
}

export default Wallet;
