import DashboardLayout from "../../components/layout/DashboardLayout";

function Wallet() {
  return (
    <DashboardLayout>

      <div className="flex justify-between items-center mb-8">

        <h1 className="text-4xl font-bold">
          Wallet
        </h1>

        <button className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg">
          + Add Funds
        </button>

      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl p-8 mb-8 shadow">

        <p className="text-lg">
          Current Balance
        </p>

        <h2 className="text-5xl font-bold mt-2">
          ₹12,500
        </h2>

      </div>

      {/* Transactions */}

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-2xl font-semibold mb-6">
          Recent Transactions
        </h2>

        <table className="w-full">

          <thead>
            <tr className="border-b">

              <th className="text-left py-3">Date</th>
              <th className="text-left">Type</th>
              <th className="text-left">Amount</th>
              <th className="text-left">Status</th>

            </tr>
          </thead>

          <tbody>

            <tr className="border-b">
              <td className="py-4">25 Jul</td>
              <td>Add Funds</td>
              <td className="text-green-600">+₹5000</td>
              <td>Success</td>
            </tr>

            <tr className="border-b">
              <td className="py-4">24 Jul</td>
              <td>Order Payment</td>
              <td className="text-red-600">-₹250</td>
              <td>Completed</td>
            </tr>

            <tr>
              <td className="py-4">23 Jul</td>
              <td>Order Payment</td>
              <td className="text-red-600">-₹300</td>
              <td>Completed</td>
            </tr>

          </tbody>

        </table>

      </div>

    </DashboardLayout>
  );
}

export default Wallet;