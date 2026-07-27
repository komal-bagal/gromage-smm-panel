import DashboardLayout from "../../components/layout/DashboardLayout";

function Tickets() {
  const tickets = [
    {
      id: "#101",
      subject: "Payment Issue",
      priority: "High",
      status: "Open",
      date: "25 Jul 2026",
    },
    {
      id: "#102",
      subject: "Order Not Started",
      priority: "Medium",
      status: "Pending",
      date: "24 Jul 2026",
    },
    {
      id: "#103",
      subject: "Refund Request",
      priority: "Low",
      status: "Closed",
      date: "22 Jul 2026",
    },
  ];

  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold mb-8">
        Support Tickets
      </h1>

      {/* Create Ticket */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-semibold mb-5">
          Create Ticket
        </h2>

        <div className="space-y-5">

          <div>
            <label className="block mb-2 font-medium">
              Subject
            </label>

            <input
              type="text"
              placeholder="Enter Subject"
              className="w-full border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Priority
            </label>

            <select className="w-full border rounded-lg p-3">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Message
            </label>

            <textarea
              rows="5"
              placeholder="Write your issue..."
              className="w-full border rounded-lg p-3"
            ></textarea>
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg">
            Submit Ticket
          </button>

        </div>

      </div>

      {/* Ticket History */}

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-xl font-semibold mb-5">
          Ticket History
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead>

              <tr className="bg-gray-100">

                <th className="text-left p-3">Ticket ID</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Date</th>

              </tr>

            </thead>

            <tbody>

              {tickets.map((ticket) => (

                <tr
                  key={ticket.id}
                  className="border-b hover:bg-gray-50"
                >

                  <td className="p-3">{ticket.id}</td>

                  <td className="p-3">{ticket.subject}</td>

                  <td className="p-3">{ticket.priority}</td>

                  <td className="p-3">

                    <span
                      className={`px-3 py-1 rounded-full text-sm text-white
                      ${
                        ticket.status === "Open"
                          ? "bg-green-500"
                          : ticket.status === "Pending"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    >
                      {ticket.status}
                    </span>

                  </td>

                  <td className="p-3">{ticket.date}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </DashboardLayout>
  );
}

export default Tickets;