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

      <h1 className="text-3xl font-bold mb-8">
        Refund Requests
      </h1>

      {/* Refund Form */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-semibold mb-5">
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
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Reason
            </label>

            <textarea
              rows="4"
              placeholder="Why do you need a refund?"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg">
            Submit Refund Request
          </button>

        </div>

      </div>

      {/* Refund History */}

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-xl font-semibold mb-5">
          Refund History
        </h2>

        <table className="w-full">

          <thead>

            <tr className="bg-gray-100">

              <th className="p-3 text-left">Refund ID</th>
              <th className="p-3 text-left">Order</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Reason</th>
              <th className="p-3 text-left">Status</th>

            </tr>

          </thead>

          <tbody>

            {refunds.map((refund) => (

              <tr key={refund.id} className="border-b">

                <td className="p-3">{refund.id}</td>
                <td className="p-3">{refund.order}</td>
                <td className="p-3">{refund.amount}</td>
                <td className="p-3">{refund.reason}</td>

                <td className="p-3">

                  <span
                    className={`px-3 py-1 rounded-full text-white text-sm
                    ${
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

    </DashboardLayout>
  );
}

export default Refunds;