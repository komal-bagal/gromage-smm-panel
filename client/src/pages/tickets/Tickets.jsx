/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import adminService from "../../services/adminService";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [formData, setFormData] = useState({
    subject: "",
    priority: "Medium",
    message: "",
  });

  const fetchUserTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getUserTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserTickets();
  }, [fetchUserTickets]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanSubject = formData.subject.trim();
    const cleanMessage = formData.message.trim();

    if (!cleanSubject) {
      setStatusMessage({ type: "error", text: "Please enter a ticket subject." });
      return;
    }
    if (!cleanMessage) {
      setStatusMessage({ type: "error", text: "Please enter a message describing your issue." });
      return;
    }

    setSubmitting(true);
    try {
      const created = await adminService.createTicket({
        subject: cleanSubject,
        priority: formData.priority,
        message: cleanMessage,
        department: "General",
      });

      setTickets((prev) => [created, ...prev]);
      setFormData({
        subject: "",
        priority: "Medium",
        message: "",
      });
      setStatusMessage({
        type: "success",
        text: `Support ticket #${created.id} submitted successfully! Our support staff will review it shortly.`,
      });
    } catch (err) {
      console.error("Submit ticket error:", err);
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.message || "Failed to submit support ticket. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Support Tickets
      </h1>

      {/* Create Ticket */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-5 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-5">
          Create Ticket
        </h2>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg mb-4 text-sm font-medium ${
              statusMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Subject */}
          <div>
            <label className="block mb-2 font-medium">
              Subject
            </label>
            <input
              type="text"
              placeholder="Enter Subject"
              value={formData.subject}
              onChange={(e) => handleInputChange("subject", e.target.value)}
              className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block mb-2 font-medium">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleInputChange("priority", e.target.value)}
              className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block mb-2 font-medium">
              Message
            </label>
            <textarea
              rows="5"
              placeholder="Write your issue..."
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg transition"
          >
            {submitting ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      </div>

      {/* Ticket History */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">
          Ticket History
        </h2>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse">
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
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-6 text-gray-500">
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500 font-medium">
                    No support tickets found. Create your first ticket above.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr
                    key={ticket.id || ticket._id}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="p-3 font-semibold text-blue-600">
                      {ticket.id || ticket.ticketId}
                    </td>
                    <td className="p-3 font-medium text-gray-800">{ticket.subject}</td>
                    <td className="p-3">{ticket.priority}</td>

                    <td className="p-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm text-white whitespace-nowrap ${
                          ticket.status === "Open"
                            ? "bg-green-500"
                            : ticket.status === "Pending"
                            ? "bg-yellow-500"
                            : ticket.status === "Answered"
                            ? "bg-blue-500"
                            : "bg-red-500"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap text-gray-600">
                      {ticket.date || ticket.createdAt?.split(" ")[0] || "Recent"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Hint */}
        <p className="text-xs text-gray-400 mt-3 md:hidden">
          ← Swipe to see more ticket details →
        </p>
      </div>
    </DashboardLayout>
  );
}

export default Tickets;
