import DashboardLayout from "../../components/layout/DashboardLayout";
import { useNavigate } from "react-router-dom";

function Services() {
  const navigate = useNavigate();
  return (
    <DashboardLayout>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5 sm:mb-8">

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
          Services
        </h1>

        <button
          onClick={() => navigate("/new-order")}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg transition">
          + New Order
        </button>

      </div>

      {/* Services Card */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        {/* Search */}
        <input
          type="text"
          placeholder="Search Service..."
          className="w-full border rounded-lg p-2 sm:p-3 text-sm sm:text-base mb-5 sm:mb-6 outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">

            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-2">Service</th>
                <th className="text-left py-3 px-2">Category</th>
                <th className="text-left py-3 px-2">Rate</th>
                <th className="text-left py-3 px-2">Min</th>
                <th className="text-left py-3 px-2">Max</th>
              </tr>
            </thead>

            <tbody>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-4 px-2">Instagram Followers</td>
                <td className="px-2">Instagram</td>
                <td className="px-2">₹0.25</td>
                <td className="px-2">100</td>
                <td className="px-2">100000</td>
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-4 px-2">Instagram Likes</td>
                <td className="px-2">Instagram</td>
                <td className="px-2">₹0.15</td>
                <td className="px-2">50</td>
                <td className="px-2">50000</td>
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-4 px-2">YouTube Views</td>
                <td className="px-2">YouTube</td>
                <td className="px-2">₹0.30</td>
                <td className="px-2">1000</td>
                <td className="px-2">1000000</td>
              </tr>

              <tr className="hover:bg-gray-50">
                <td className="py-4 px-2">Facebook Likes</td>
                <td className="px-2">Facebook</td>
                <td className="px-2">₹0.20</td>
                <td className="px-2">100</td>
                <td className="px-2">50000</td>
              </tr>

            </tbody>

          </table>
        </div>

        {/* Mobile Scroll Hint */}
        <p className="text-xs text-gray-400 mt-3 md:hidden">
          ← Swipe to see more service details →
        </p>

      </div>

    </DashboardLayout>
  );
}

export default Services;