import DashboardLayout from "../../components/layout/DashboardLayout";

function Orders() {
  return (
    <DashboardLayout>
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 sm:mb-6">
        Orders
      </h1>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">

        {/* Search */}
        <input
          type="text"
          placeholder="Search Order..."
          className="w-full border rounded-lg p-3 mb-5 sm:mb-6 outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">

            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-2">Order ID</th>
                <th className="text-left py-3 px-2">Service</th>
                <th className="text-left py-3 px-2">Quantity</th>
                <th className="text-left py-3 px-2">Charge</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Date</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-2">#1001</td>
                <td className="px-2">Instagram Followers</td>
                <td className="px-2">1000</td>
                <td className="px-2">₹250</td>
                <td className="px-2 text-green-600 font-medium">
                  Completed
                </td>
                <td className="px-2">25 Jul</td>
              </tr>

              <tr className="border-b hover:bg-gray-50">
                <td className="py-3 px-2">#1002</td>
                <td className="px-2">YouTube Views</td>
                <td className="px-2">5000</td>
                <td className="px-2">₹500</td>
                <td className="px-2 text-yellow-500 font-medium">
                  Pending
                </td>
                <td className="px-2">24 Jul</td>
              </tr>

              <tr className="hover:bg-gray-50">
                <td className="py-3 px-2">#1003</td>
                <td className="px-2">Facebook Likes</td>
                <td className="px-2">2000</td>
                <td className="px-2">₹300</td>
                <td className="px-2 text-blue-600 font-medium">
                  Processing
                </td>
                <td className="px-2">23 Jul</td>
              </tr>
            </tbody>

          </table>
        </div>

        {/* Mobile hint */}
        <p className="text-xs text-gray-400 mt-3 md:hidden">
          Swipe left to see more order details →
        </p>

      </div>
    </DashboardLayout>
  );
}

export default Orders;