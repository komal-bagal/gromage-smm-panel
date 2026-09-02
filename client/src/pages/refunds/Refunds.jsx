import DashboardLayout from "../../components/layout/DashboardLayout";

function Refunds() {
  const refunds = [
    {
      id: "#1001",
      order: "#5001",
      amount: "₹250",
      reason: "Order Not Completed",
      status: "Pending",
    },
    {
      id: "#1002",
      order: "#5002",
      amount: "₹120",
      reason: "Partial Delivery",
      status: "Approved",
    },
    {
      id: "#1003",
      order: "#5003",
      amount: "₹75",
      reason: "Wrong Service",
      status: "Rejected",
    },
  ];

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Refund Requests
      </h1>

      {/* Refund Form */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-5 sm:mb-8">

        <h2 className="text-lg sm:text-xl font-semibold mb-5">
          Request Refund
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block mb-2 font-medium">
              Order ID
            </label>

            <input
              type="text"
              placeholder="Enter Order ID"
              className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Reason
            </label>

            <textarea
              rows="4"
              placeholder="Why do you need a refund?"
              className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition">
            Submit Refund Request
          </button>
        </div>

      </div>

      {/* Refund History */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">
          Refund History
        </h2>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">

            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-3 text-left">Refund ID</th>
                <th className="p-3 text-left">Order</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Reason</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {refunds.map((refund) => (
                <tr key={refund.id} className="border-b hover:bg-gray-50">

                  <td className="p-3">{refund.id}</td>
                  <td className="p-3">{refund.order}</td>
                  <td className="p-3">{refund.amount}</td>
                  <td className="p-3">{refund.reason}</td>

                  <td className="p-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-white text-sm whitespace-nowrap ${
                        refund.status === "Approved"
                          ? "bg-green-500"
                          : refund.status === "Pending"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    >
                      {refund.status}
                    </span>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>

        {/* Mobile Hint */}
        <p className="text-xs text-gray-400 mt-3 md:hidden">
          ← Swipe to see more refund details →
        </p>

      </div>
    </DashboardLayout>
  );
}

export default Refunds;