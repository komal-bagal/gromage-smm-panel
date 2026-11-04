import { useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import api from "../../services/api";

function MassOrder() {
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isSubmitting) return;

    setStatusMessage(null);
    const lines = inputText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Please enter at least one order line in the format: service_id | link | quantity",
      });
      return;
    }

    const parsedOrders = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split("|").map((p) => p.trim());
      if (parts.length < 3) {
        setStatusMessage({
          type: "error",
          text: `Line ${i + 1} has invalid format. Required: service_id | link | quantity`,
        });
        return;
      }

      const [serviceId, link, quantityStr] = parts;
      const quantity = Number(quantityStr);

      if (!link || isNaN(quantity) || quantity <= 0) {
        setStatusMessage({
          type: "error",
          text: `Line ${i + 1} contains an invalid link or quantity.`,
        });
        return;
      }

      parsedOrders.push({
        serviceId,
        link,
        quantity,
      });
    }

    setIsSubmitting(true);

    try {
      const res = await api.post("/api/order", {
        orders: parsedOrders,
      });

      if (res.data?.success) {
        setStatusMessage({
          type: "success",
          text: `Successfully processed ${parsedOrders.length} mass orders!`,
        });
        setInputText("");
      } else {
        setStatusMessage({
          type: "error",
          text: res.data?.message || "Failed to process mass orders.",
        });
      }
    } catch (err) {
      console.error("Mass order submission error:", err);
      const backendMessage =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.data?.error;

      let msg = "Failed to submit mass orders.";
      if (backendMessage && typeof backendMessage === "string") {
        msg = backendMessage.trim();
      } else if (err?.status === 403) {
        msg = "Mass order submission requires authorization on the server.";
      }

      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Mass Order
      </h1>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">
          Paste Multiple Orders
        </h2>

        <p className="text-sm text-gray-500 mb-4">
          Enter one order per line using the standard delimiter format:
          <code className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono font-semibold text-gray-800">
            service_id | link | quantity
          </code>
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

        <form onSubmit={handleSubmit}>
          <textarea
            rows="10"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`6ad8bd6eb5337a9a1b23fad3 | https://instagram.com/myprofile | 1000\n6ad8bd6eb5337a9a1b23fad3 | https://instagram.com/secondprofile | 500`}
            className="w-full border rounded-lg p-3 sm:p-4 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
          />

          <button
            type="submit"
            disabled={isSubmitting || !inputText.trim()}
            className="w-full sm:w-auto mt-4 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? "Submitting Bulk Orders..." : "Submit Mass Orders"}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default MassOrder;
