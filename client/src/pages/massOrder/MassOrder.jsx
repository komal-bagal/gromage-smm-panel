import DashboardLayout from "../../components/layout/DashboardLayout";

function MassOrder() {
  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold mb-8">
        Mass Order
      </h1>

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-xl font-semibold mb-5">
          Paste Orders
        </h2>

        <p className="text-gray-500 mb-4">
          One order per line.
        </p>

        <textarea
          rows="12"
          placeholder={`service_id | link | quantity

1 | https://instagram.com/user | 1000

2 | https://youtube.com/video | 5000`}
          className="w-full border rounded-lg p-4"
        />

        <button className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg">
          Submit Orders
        </button>

      </div>

    </DashboardLayout>
  );
}

export default MassOrder;