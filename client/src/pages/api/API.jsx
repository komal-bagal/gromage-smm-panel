import DashboardLayout from "../../components/layout/DashboardLayout";

function API() {
  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold mb-8">
        API Documentation
      </h1>

      {/* API Details */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-semibold mb-5">
          API Information
        </h2>

        <div className="space-y-5">

          <div>
            <label className="block font-medium mb-2">
              API URL
            </label>

            <input
              value="https://api.gromage.com/v1"
              readOnly
              className="w-full border rounded-lg p-3 bg-gray-100"
            />
          </div>

          <div>
            <label className="block font-medium mb-2">
              API Key
            </label>

            <input
              value="****************************"
              readOnly
              className="w-full border rounded-lg p-3 bg-gray-100"
            />
          </div>

          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
            Generate API Key
          </button>

        </div>

      </div>

      {/* Methods */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-semibold mb-5">
          Available Methods
        </h2>

        <ul className="space-y-3">

          <li>✅ Get Balance</li>
          <li>✅ Get Services</li>
          <li>✅ Create Order</li>
          <li>✅ Order Status</li>
          <li>✅ Refill</li>
          <li>✅ Cancel Order</li>

        </ul>

      </div>

      {/* Example Request */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">

        <h2 className="text-xl font-semibold mb-5">
          Example Request
        </h2>

        <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
{`POST /api/v1

key=YOUR_API_KEY

action=balance`}
        </pre>

      </div>

      {/* Example Response */}

      <div className="bg-white rounded-xl shadow p-6">

        <h2 className="text-xl font-semibold mb-5">
          Example Response
        </h2>

        <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
{`{
  "balance": 2500,
  "currency": "INR"
}`}
        </pre>

      </div>

    </DashboardLayout>
  );
}

export default API;