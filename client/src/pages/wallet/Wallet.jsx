import DashboardLayout from "../../components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";

function Wallet() {
  const navigate = useNavigate();
  return (
    <DashboardLayout>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5 sm:mb-8">

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
          Wallet
        </h1>

        <button
  onClick={() => navigate("/add-funds")}
  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg transition"
>
  + Add Funds
</button>

      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-5 sm:p-8 mb-5 sm:mb-8 shadow">

        <p className="text-base sm:text-lg">
          Current Balance
        </p>

        <h2 className="text-3xl sm:text-5xl font-bold mt-2">
          ₹12,500
        </h2>

      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">
          Recent Transactions
        </h2>

        {/* Responsive Table */}
        <div className="overflow-x-auto">

          <table className="w-full min-w-[500px]">

            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-2">Date</th>
                <th className="text-left py-3 px-2">Type</th>
                <th className="text-left py-3 px-2">Amount</th>
                <th className="text-left py-3 px-2">Status</th>
              </tr>
            </thead>

            <tbody>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-4 px-2">25 Jul</td>
                <td className="px-2">Add Funds</td>
                <td className="px-2 text-green-600 font-medium">+₹5000</td>
                <td className="px-2">Success</td>
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-4 px-2">24 Jul</td>
                <td className="px-2">Order Payment</td>
                <td className="px-2 text-red-600 font-medium">-₹250</td>
                <td className="px-2">Completed</td>
              </tr>

              <tr className="hover:bg-gray-50">
                <td className="py-4 px-2">23 Jul</td>
                <td className="px-2">Order Payment</td>
                <td className="px-2 text-red-600 font-medium">-₹300</td>
                <td className="px-2">Completed</td>
              </tr>

            </tbody>

          </table>

        </div>

        {/* Mobile Scroll Hint */}
        <p className="text-xs text-gray-400 mt-3 md:hidden">
          ← Swipe to see more transaction details →
        </p>

      </div>

    </DashboardLayout>
  );
}

export default Wallet;