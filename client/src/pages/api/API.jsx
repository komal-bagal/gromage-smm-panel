import { useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";

function API() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const apiUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api`
    : "http://localhost:5000/api";

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(apiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasApiKey = Boolean(user?.apiKey);

  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-8">
        API Documentation
      </h1>

      {/* API Details */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-5 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-5">
          API Credentials & Endpoint
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block font-medium mb-2 text-sm text-gray-700">
              API Base URL
            </label>

            <div className="flex gap-2">
              <input
                value={apiUrl}
                readOnly
                className="flex-1 border rounded-lg p-2.5 sm:p-3 text-sm bg-gray-50 outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="bg-gray-100 hover:bg-gray-200 border px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-2 text-sm text-gray-700">
              Your API Key
            </label>

            <input
              value={hasApiKey ? user.apiKey : "API access available for Developer & Reseller accounts"}
              readOnly
              className="w-full border rounded-lg p-2.5 sm:p-3 text-sm bg-gray-50 outline-none font-mono"
            />
          </div>

          {!hasApiKey && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-lg">
              ℹ️ Personal accounts can submit tickets to request Reseller API activation and receive an individual API key.
            </p>
          )}
        </div>
      </div>

      {/* Methods */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-5 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-5">
          Supported REST API Endpoints
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg border">
            <span className="font-mono text-emerald-600 font-bold mr-2">GET</span>
            <span className="font-mono text-gray-800">/api/service</span>
            <p className="text-xs text-gray-500 mt-1">Retrieve active services, categories and rates</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <span className="font-mono text-blue-600 font-bold mr-2">POST</span>
            <span className="font-mono text-gray-800">/api/order</span>
            <p className="text-xs text-gray-500 mt-1">Submit single automated orders</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <span className="font-mono text-emerald-600 font-bold mr-2">GET</span>
            <span className="font-mono text-gray-800">/api/order</span>
            <p className="text-xs text-gray-500 mt-1">Check order history and real-time statuses</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <span className="font-mono text-emerald-600 font-bold mr-2">GET</span>
            <span className="font-mono text-gray-800">/api/user/profile</span>
            <p className="text-xs text-gray-500 mt-1">Check available wallet balance and account tier</p>
          </div>
        </div>
      </div>

      {/* Example Request */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 mb-5 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">
          Example Authorization Header
        </h2>

        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs sm:text-sm font-mono whitespace-pre">
{`curl -X GET "${apiUrl}/service" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json"`}
        </pre>
      </div>

      {/* Example Response */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">
          Example Service Response
        </h2>

        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs sm:text-sm font-mono whitespace-pre">
{`{
  "success": true,
  "services": [
    {
      "id": "6ad8bd6eb5337a9a1b23fad3",
      "name": "Instagram Followers - Fast Delivery",
      "category": "Instagram",
      "rate": 0.25,
      "min": 100,
      "max": 100000
    }
  ]
}`}
        </pre>
      </div>
    </DashboardLayout>
  );
}

export default API;
