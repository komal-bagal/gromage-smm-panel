import DashboardLayout from "../../components/layout/DashboardLayout";

function MassOrder() {
  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        Mass Order
      </h1>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-5">
          Paste Orders
        </h2>

        <p className="text-sm sm:text-base text-gray-500 mb-4">
          One order per line.
        </p>

        <textarea
          rows="12"
          placeholder={`service_id | link | quantity

1 | https://instagram.com/user | 1000

2 | https://youtube.com/video | 5000`}
          className="w-full border rounded-lg p-3 sm:p-4 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        <button className="w-full sm:w-auto mt-5 sm:mt-6 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition">
          Submit Orders
        </button>

      </div>
    </DashboardLayout>
  );
}

export default MassOrder;